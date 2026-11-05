import express, { Router } from "express";
import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { rateLimit } from "express-rate-limit";
import { AuthorizePostMediaUploadBody } from "@workspace/api-zod";
import { verifiedUser } from "../lib/firebaseIdentity";
import { AiServiceError } from "../lib/groq";
import {
  MAX_POST_MEDIA_BYTES, POST_MEDIA_PATH, POST_MEDIA_TYPES, validatePostMediaPath,
} from "../lib/postMediaPolicy";

const router = Router();
const limitUploads = rateLimit({
  windowMs: 15 * 60_000, limit: 20,
  keyGenerator: (_req, res) => res.locals.uid,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many uploads. Wait a few minutes before trying again." },
});

// Only metadata passes through this function. File bytes go straight to Blob,
// avoiding Vercel's function request-size limit for videos.
router.post("/uploads", express.json({ limit: "8kb" }), async (req, res, next) => {
  const parsed = AuthorizePostMediaUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload request." });
    return;
  }
  req.body = parsed.data;
  try {
    res.locals.uid = await verifiedUser(req);
    next();
  } catch (error) {
    res.status(error instanceof AiServiceError ? error.status : 503).json({
      error: error instanceof AiServiceError ? error.message : "Could not verify your account.",
    });
  }
}, limitUploads, async (req, res) => {
  try {
    const result = await handleUpload({
      request: req,
      body: req.body as HandleUploadBody,
      onBeforeGenerateToken: async (pathname) => {
        validatePostMediaPath(pathname, res.locals.uid as string);
        return {
          allowedContentTypes: POST_MEDIA_TYPES,
          maximumSizeInBytes: MAX_POST_MEDIA_BYTES,
          validUntil: Date.now() + 15 * 60_000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    res.json(result);
  } catch (error) {
    const invalidPath = error instanceof Error && error.message.includes("own account");
    req.log.warn({ invalidPath }, "Post media upload authorization failed");
    res.status(invalidPath ? 403 : 503).json({
      error: invalidPath
        ? "You can upload media only to your own account."
        : "Video and photo uploads are temporarily unavailable. Your post has not been cleared.",
    });
  }
});

// Community media has an unguessable ID, as do the existing profile photos.
// Keep the Blob store private; never expose its read/write credential.
router.get("/:uid/:filename", async (req, res) => {
  const pathname = `post-media/${req.params.uid}/${req.params.filename}`;
  if (!POST_MEDIA_PATH.test(pathname)) { res.status(404).end(); return; }
  const range = req.get("Range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) { res.status(416).end(); return; }
  try {
    const result = await get(pathname, {
      access: "private",
      ...(range ? { headers: { Range: range } } : {}),
    });
    if (!result || result.statusCode !== 200 ||
      !POST_MEDIA_TYPES.includes(result.blob.contentType.split(";")[0])) {
      if (result?.stream) await result.stream.cancel();
      res.status(404).end(); return;
    }
    res.setHeader("Content-Type", result.blob.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Accept-Ranges", "bytes");
    for (const header of ["content-length", "content-range", "etag"]) {
      const value = result.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.status(result.headers.has("content-range") ? 206 : 200);
    if (req.method === "HEAD") { await result.stream.cancel(); res.end(); return; }
    const stream = Readable.fromWeb(result.stream as Parameters<typeof Readable.fromWeb>[0]);
    res.on("close", () => stream.destroy());
    stream.on("error", () => {
      if (!res.headersSent) res.status(503).end();
      else res.destroy();
    });
    stream.pipe(res);
  } catch {
    res.status(404).end();
  }
});

export default router;
