import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Strip markdown code-fence wrappers the model sometimes adds despite the system prompt
function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return raw.slice(firstBrace, lastBrace + 1);
  }
  return raw.trim();
}

router.post("/scam-check", async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const trimmed = message.trim();

  if (trimmed.length > 3000) {
    res.status(400).json({ error: "Message too long. Maximum 3000 characters." });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert scam detection AI. Analyze the provided message and determine if it is likely a scam.

You MUST respond with a valid JSON object with exactly these fields:
- "isScam": boolean — true if the message is likely a scam or phishing attempt
- "confidence": "high" | "medium" | "low" — your certainty in the verdict
- "explanation": string — 2–3 sentences explaining your analysis
- "redFlags": string[] — specific red flags found (empty array if none)
- "recommendation": string — 1–2 sentences of actionable advice for the user
- "scamType": string | null — the category of scam if detected (e.g. "Phishing", "Lottery scam", "Romance scam", "Tech support scam", "Investment fraud", "Impersonation"), or null if not a scam

Common scam patterns to check:
- Urgency or pressure tactics ("Act now", "Limited time")
- Unexpected prize or lottery wins requiring payment to claim
- Requests for OTPs, passwords, or banking details
- Suspicious or lookalike URLs
- Too-good-to-be-true financial offers
- Impersonation of banks, government, telecoms, or tech companies
- Cryptocurrency, wire transfer, or gift card payment requests
- Threatening language (legal action, account suspension)
- Unsolicited contact with personal information claims
- Poor grammar used intentionally to target vulnerable users`,
        },
        {
          role: "user",
          content: `Analyze this message for scam indicators:\n\n${trimmed}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const json = extractJson(raw);

    const result = JSON.parse(json) as {
      isScam: boolean;
      confidence: "high" | "medium" | "low";
      explanation: string;
      redFlags: string[];
      recommendation: string;
      scamType: string | null;
    };

    // Validate shape — avoid passing garbage to the client
    if (typeof result.isScam !== "boolean") {
      throw new Error("Invalid response shape from AI");
    }

    res.json({
      isScam: Boolean(result.isScam),
      confidence: ["high", "medium", "low"].includes(result.confidence)
        ? result.confidence
        : "low",
      explanation: String(result.explanation ?? ""),
      redFlags: Array.isArray(result.redFlags) ? result.redFlags.map(String) : [],
      recommendation: String(result.recommendation ?? ""),
      scamType: result.scamType ?? null,
    });
  } catch (err) {
    req.log.error(err, "Scam check failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
