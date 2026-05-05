import { Router } from "express";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
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
  const imageSize: ValidSize = validSizes.includes(size as ValidSize)
    ? (size as ValidSize)
    : "1024x1024";

  const buffer = await generateImageBuffer(prompt, imageSize);
  res.json({ b64_json: buffer.toString("base64"), prompt });
});

router.post("/swiftop/generate-animation", async (req, res) => {
  const parsed = GenerateAnimationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, frameCount = 4 } = parsed.data;
  const count = Math.min(Math.max(frameCount, 2), 6);

  const framePrompts = Array.from({ length: count }, (_, i) => {
    const progress = i / (count - 1);
    const phaseDescriptions = [
      "beginning, initial state",
      "early transition",
      "midpoint transformation",
      "late transition",
      "near completion",
      "final state, fully transformed",
    ];
    const phase = phaseDescriptions[Math.floor(progress * (phaseDescriptions.length - 1))];
    return `${prompt} — animation frame ${i + 1} of ${count}, ${phase}, cinematic lighting, highly detailed`;
  });

  const frameBuffers = await Promise.all(
    framePrompts.map((fp) => generateImageBuffer(fp, "1024x1024"))
  );

  const frames = frameBuffers.map((buf) => buf.toString("base64"));
  res.json({ frames, prompt, frameCount: count });
});

export default router;
