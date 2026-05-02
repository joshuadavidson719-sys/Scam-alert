import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) return raw.slice(firstBrace, lastBrace + 1);
  return raw.trim();
}

router.post("/phone-check", async (req, res) => {
  const { phone } = req.body as { phone?: string };

  if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
    res.status(400).json({ error: "Phone number is required" });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a fraud detection expert analyzing phone numbers for scam indicators.

Respond with a valid JSON object:
- "isSuspicious": boolean
- "riskLevel": "high" | "medium" | "low" | "safe"
- "explanation": string (2-3 sentences)
- "redFlags": string[] (empty if safe)
- "recommendation": string (actionable advice)
- "scamType": string | null (e.g. "Robocall", "Spoofed number", "IRS scam", "Tech support scam", "One-ring scam", etc.)

Consider: premium-rate number prefixes, known international scam country codes, spoofed numbers, patterns typical of robocalls, and commonly reported scam number formats.`,
        },
        {
          role: "user",
          content: `Analyze this phone number for scam risk: ${phone.trim()}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(extractJson(raw)) as {
      isSuspicious?: boolean;
      riskLevel?: string;
      explanation?: string;
      redFlags?: unknown[];
      recommendation?: string;
      scamType?: string | null;
    };

    res.json({
      isSuspicious: Boolean(result.isSuspicious),
      riskLevel: ["high", "medium", "low", "safe"].includes(result.riskLevel ?? "")
        ? result.riskLevel
        : "low",
      explanation: String(result.explanation ?? ""),
      redFlags: Array.isArray(result.redFlags) ? result.redFlags.map(String) : [],
      recommendation: String(result.recommendation ?? ""),
      scamType: result.scamType ?? null,
    });
  } catch (err) {
    req.log.error(err, "Phone check failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
