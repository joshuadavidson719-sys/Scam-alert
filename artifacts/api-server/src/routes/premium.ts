import { Router } from "express";
import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { rateLimit } from "express-rate-limit";
import {
  GeneratePremiumImageBody, GeneratePremiumAnimationBody, RecoverPremiumGenerationParams,
} from "@workspace/api-zod";
import type { PremiumGenerationInput, PremiumGenerationResult } from "@workspace/api-zod";
import { verifiedUser } from "../lib/firebaseIdentity";
import { AiServiceError } from "../lib/groq";
import { subscriptionFor, creditPeriodKey, generationReady, canUsePaidGeneration, MONTHLY_CREDITS } from "../lib/premiumAccess";
import { findGeneration, remainingCredits, reserveCredits, settleCredits, reclaimStaleCredits } from "../lib/creditLedger";
import { readGeneration, saveGeneration } from "../lib/generationStorage";

const router = Router();
const limit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many requests. Wait a minute and try again." } });
router.use(["/premium", "/swiftop"], limit);

function errorResponse(error: unknown) {
  return {
    status: error instanceof AiServiceError ? error.status : 503,
    error: error instanceof AiServiceError ? error.message : "Premium is temporarily unavailable. Please try again later.",
  };
}

router.get("/premium/status", async (req, res) => {
  try {
    const userId = await verifiedUser(req, true);
    if (process.env.VERCEL === "1" && !generationReady()) {
      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        premium: false, generationAccess: false, creditsRemaining: 0,
        monthlyCredits: MONTHLY_CREDITS, periodEndsAt: null, generationAvailable: false,
        availabilityMessage: "Premium image generation is not available yet. No paid access is currently offered.",
      });
      return;
    }
    if (userId) await reclaimStaleCredits(userId);
    const subscription = userId ? await subscriptionFor(userId) : null;
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      premium: !!subscription,
      generationAccess: !!subscription && !!userId && canUsePaidGeneration(subscription, userId),
      creditsRemaining: subscription ? await remainingCredits(creditPeriodKey(subscription)) : 0,
      monthlyCredits: MONTHLY_CREDITS,
      periodEndsAt: subscription?.current_period_ends_at ? new Date(subscription.current_period_ends_at).toISOString() : null,
      generationAvailable: generationReady(),
      availabilityMessage: generationReady() ? null : "Premium generation is not available yet. Store setup and image-service billing must be completed before paid access is offered.",
    });
  } catch (error) {
    const failure = errorResponse(error);
    req.log.warn({ status: failure.status }, "Premium status unavailable");
    res.status(failure.status).json({ error: failure.error });
  }
});

async function recovered(id: string, userId: string) {
  const existing = await findGeneration(id, userId);
  if (!existing) throw new AiServiceError(404, "Generation not found.");
  if (existing.status === "processing") throw new AiServiceError(409, "This generation is still running. Recover it again in a moment.");
  const result = await readGeneration(userId, id);
  if (!result) throw new AiServiceError(410, "No image was completed. Reserved credits are returned when a failed request is settled.");
  return result;
}

router.get("/swiftop/generations/:requestId", async (req, res) => {
  try {
    const userId = (await verifiedUser(req))!;
    const parsed = RecoverPremiumGenerationParams.safeParse(req.params);
    if (!parsed.success) throw new AiServiceError(400, "Invalid generation ID.");
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await recovered(parsed.data.requestId, userId));
  } catch (error) {
    const failure = errorResponse(error);
    res.status(failure.status).json({ error: failure.error });
  }
});

for (const mode of ["image", "animation"] as const) {
  router.post(`/swiftop/generate-${mode}`, async (req, res) => {
    let reservation: { id: string; user: string } | null = null;
    let frames: string[] = [];
    let result: PremiumGenerationResult | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240_000);
    try {
      const userId = (await verifiedUser(req))!;
      const parsed = (mode === "image" ? GeneratePremiumImageBody : GeneratePremiumAnimationBody).safeParse(req.body);
      if (!parsed.success || !parsed.data.prompt.trim()) throw new AiServiceError(400, "Check your prompt and generation settings.");
      const input: PremiumGenerationInput = parsed.data;
      if (!generationReady()) throw new AiServiceError(503, "Premium generation is not available yet. No credits were used.");
      const previous = await findGeneration(input.requestId, userId);
      if (previous) {
        const fingerprint = createHash("sha256").update(JSON.stringify({ mode, ...input })).digest("hex");
        if (previous.fingerprint !== fingerprint) throw new AiServiceError(409, "Use a new request ID when changing the prompt or settings.");
        res.json(await recovered(input.requestId, userId));
        return;
      }
      const subscription = await subscriptionFor(userId);
      if (!subscription || !canUsePaidGeneration(subscription, userId)) {
        throw new AiServiceError(403, "A verified Google Play Premium purchase is required. Test Store purchases cannot authorize real image generation.");
      }
      const count = mode === "image" ? 1 : input.frameCount ?? 8;
      const fingerprint = createHash("sha256").update(JSON.stringify({ mode, ...input })).digest("hex");
      const duplicate = await reserveCredits(input.requestId, userId, creditPeriodKey(subscription), count, fingerprint);
      if (duplicate) {
        res.json(await recovered(input.requestId, userId));
        return;
      }
      reservation = { id: input.requestId, user: userId };
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 50_000, maxRetries: 0 });
      const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
      for (let index = 0; index < count; index++) {
        const options = { model, quality: "low" as const, size: mode === "image" ? input.size ?? "1024x1024" : "1024x1024" as const, output_format: "png" as const, n: 1 };
        const image = index === 0
          ? await client.images.generate({ ...options, prompt: input.prompt }, { signal: controller.signal })
          : await client.images.edit({
            ...options,
            image: await toFile(Buffer.from(frames[index - 1], "base64"), "frame.png", { type: "image/png" }),
            prompt: `Continue this same scene with consistent subjects and style. ${input.prompt}. Animation frame ${index + 1} of ${count}. Apply a small ${input.style ?? "flow"} movement; avoid text, cuts, or a new composition.`,
          }, { signal: controller.signal });
        const b64 = image.data?.[0]?.b64_json;
        if (!b64) throw new Error("Provider returned no image");
        const nextFrames = [...frames, b64];
        const completed: PremiumGenerationResult = {
          requestId: input.requestId, prompt: input.prompt,
          b64_json: nextFrames[0], frames: nextFrames, frameCount: nextFrames.length,
          fps: input.fps ?? 8, partial: nextFrames.length < count, creditsCharged: nextFrames.length,
        };
        // Save before charging. Private results remain recoverable after a dropped response.
        await saveGeneration(userId, input.requestId, completed);
        result = completed;
        frames = nextFrames;
      }
      await settleCredits(input.requestId, frames.length);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(result);
    } catch (error) {
      if (reservation) {
        try {
          await settleCredits(reservation.id, frames.length);
        } catch {
          req.log.error({ requestId: reservation.id }, "Credit settlement needs recovery");
        }
      }
      if (frames.length && result) {
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ ...result, partial: true });
      } else {
        const failure = errorResponse(error);
        req.log.warn({ status: failure.status }, "Premium generation failed");
        res.status(failure.status).json({ error: failure.error });
      }
    } finally { clearTimeout(timeout); }
  });
}
export default router;
