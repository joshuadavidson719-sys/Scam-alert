import { Router } from "express";
import { generateImageBuffer, editImageFromBuffer } from "@workspace/integrations-openai-ai-server/image";
import { GenerateImageBody, GenerateAnimationBody } from "@workspace/api-zod";

const router = Router();

router.post("/swiftop/generate-image", async (req, res) => {
  const parsed = GenerateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, size = "1024x1024" } = parsed.data;
  const validSizes = ["1024x1024", "1536x1024", "1024x1536"] as const;
  type ValidSize = (typeof validSizes)[number];
  const imageSize: ValidSize = validSizes.includes(size as ValidSize) ? (size as ValidSize) : "1024x1024";

  const buffer = await generateImageBuffer(prompt, imageSize);
  res.json({ b64_json: buffer.toString("base64"), prompt });
});

// ── Motion instruction builder ────────────────────────────────────────────────
function buildEditPrompt(
  basePrompt: string,
  style: string,
  frameIdx: number,
  total: number,
): string {
  const pct = Math.round((frameIdx / (total - 1)) * 100);

  const styleInstructions: Record<string, string> = {
    zoom: `gradually zoom into the most interesting part of the scene, now ${pct}% zoomed in`,
    pan: `slowly pan the camera across the scene, now ${pct}% panned, keep the same dramatic atmosphere`,
    morph: `smoothly evolve and transform the elements, ${pct}% transformed toward the final state`,
    flow: `continue the natural organic motion — light shifts, particles move, atmosphere breathes — ${pct}% through`,
  };

  const motion = styleInstructions[style] ?? styleInstructions.flow;

  return (
    `Keep this exact scene, characters, colors, and lighting. ` +
    `${motion}. ` +
    `Maintain perfect visual continuity with the previous frame. ` +
    `${basePrompt}. ` +
    `Cinematic, ultra-detailed, 8K, photorealistic.`
  );
}

router.post("/swiftop/generate-animation", async (req, res) => {
  const parsed = GenerateAnimationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, frameCount = 8, style = "flow", fps = 8 } = parsed.data as {
    prompt: string;
    frameCount?: number;
    style?: string;
    fps?: number;
  };

  const count = Math.min(Math.max(frameCount, 4), 12);
  const targetFps = Math.min(Math.max(fps ?? 8, 4), 16);

  // Generate anchor frame with a rich cinematic prompt
  const firstPrompt = [
    prompt,
    "cinematic composition, dramatic lighting, ultra-detailed, 8K, photorealistic",
    "opening frame, establishing shot",
  ].join(", ");

  const firstFrame = await generateImageBuffer(firstPrompt, "1024x1024");
  const frameBuffers: Buffer[] = [firstFrame];

  // Chain each subsequent frame from the previous — real motion continuity
  for (let i = 1; i < count; i++) {
    const editPrompt = buildEditPrompt(prompt, style, i, count);
    const nextFrame = await editImageFromBuffer(frameBuffers[i - 1], editPrompt);
    frameBuffers.push(nextFrame);
  }

  const frames = frameBuffers.map((buf) => buf.toString("base64"));
  res.json({ frames, prompt, frameCount: count, fps: targetFps });
});

export default router;
