import express, { Router, type RequestHandler, type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { UploadProfilePhotoBody, GetProfilePhotoParams } from "@workspace/api-zod";
import {
  saveProfilePhoto, readProfilePhoto, deleteProfilePhotoFile,
  MAX_PROFILE_PHOTO_BYTES, PROFILE_PHOTO_SIZE_ERROR,
} from "../lib/profilePhotoStorage";
import { verifiedUser } from "../lib/firebaseIdentity";
import { AiServiceError } from "../lib/groq";

const router = Router();
const authenticate: RequestHandler = async (req, res, next) => {
  try {
    res.locals.uid = await verifiedUser(req);
    next();
  } catch (error) {
    res.status(error instanceof AiServiceError ? error.status : 503).json({
      error: error instanceof AiServiceError ? error.message : "Could not verify your account.",
    });
  }
};
const uploadLimit = rateLimit({
  windowMs: 15 * 60_000, limit: 12, keyGenerator: (_req, res) => res.locals.uid,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many photo uploads. Wait a few minutes and try again." },
});

export function imageContentType(bytes: Buffer) {
  if (bytes.length < 16 || bytes.length > MAX_PROFILE_PHOTO_BYTES) throw new AiServiceError(400, PROFILE_PHOTO_SIZE_ERROR);
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.length < 24) throw new AiServiceError(400, "This PNG file is incomplete.");
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width * height > 25_000_000) throw new AiServiceError(400, "Choose a smaller image or crop it first.");
    return "image/png";
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  throw new AiServiceError(400, "Choose a JPG, PNG, or WebP photo. SVG and other file types are not supported.");
}

// Base64 adds one third: 3 MB photos fit below Vercel's 4.5 MB request limit.
router.post("/", authenticate, uploadLimit, express.json({ limit: "4200kb" }), async (req, res) => {
  try {
    const body = UploadProfilePhotoBody.safeParse(req.body);
    if (!body.success || body.data.imageBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data.imageBase64)) {
      res.status(400).json({ error: "The selected photo could not be read. Please select it again." });
      return;
    }
    const bytes = Buffer.from(body.data.imageBase64, "base64");
    const contentType = imageContentType(bytes);
    const uid = res.locals.uid as string;
    const id = randomUUID();
    await saveProfilePhoto(uid, id, bytes, contentType);
    res.status(201).json({ path: `/api/profile-photos/${uid}/${id}` });
  } catch (error) {
    req.log.warn({ status: error instanceof AiServiceError ? error.status : 503 }, "Profile photo upload failed");
    res.status(error instanceof AiServiceError ? error.status : 503).json({
      error: error instanceof AiServiceError ? error.message : "Could not upload your photo. Your previous photo has not changed. Please try again.",
    });
  }
});

router.get("/:uid/:photoId", async (req, res) => {
  const params = GetProfilePhotoParams.safeParse(req.params);
  if (!params.success) { res.status(404).end(); return; }
  try {
    const photo = await readProfilePhoto(params.data.uid, params.data.photoId);
    if (!photo || !["image/jpeg", "image/png", "image/webp"].includes(photo.contentType)) {
      photo?.stream.destroy();
      res.status(404).end(); return;
    }
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    const stream = photo.stream;
    stream.on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
    stream.pipe(res);
  } catch { res.status(404).end(); }
});

router.delete("/:uid/:photoId", authenticate, async (req, res) => {
  const params = GetProfilePhotoParams.safeParse(req.params);
  if (!params.success) { res.status(404).end(); return; }
  if (params.data.uid !== res.locals.uid) { res.status(403).json({ error: "You can only delete your own photo uploads." }); return; }
  try {
    await deleteProfilePhotoFile(params.data.uid, params.data.photoId);
    res.status(204).end();
  } catch { res.status(503).json({ error: "Could not remove the unused upload. Please try again." }); }
});
const handleBodyError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.too.large") { res.status(413).json({ error: PROFILE_PHOTO_SIZE_ERROR }); return; }
  if (error instanceof SyntaxError) { res.status(400).json({ error: "The photo upload was not valid." }); return; }
  next(error);
};
router.use(handleBodyError);
export default router;
