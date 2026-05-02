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

router.post("/link-check", async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== "string" || url.trim().length === 0) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  if (url.trim().length > 2000) {
    res.status(400).json({ error: "URL too long." });
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
          content: `You are a cybersecurity expert analyzing URLs for phishing, malware, and scam indicators.

Respond with a valid JSON object:
- "isSuspicious": boolean
- "riskLevel": "high" | "medium" | "low" | "safe"
- "explanation": string (2-3 sentences)
- "redFlags": string[] (empty if safe)
- "recommendation": string (1-2 sentences of advice)

Check for: lookalike domains, suspicious TLDs, URL shorteners, HTTP (not HTTPS), excessive subdomains, random character strings, known phishing patterns, misleading brand names.`,
        },
        {
          role: "user",
          content: `Analyze this URL for scam/phishing risk: ${url.trim()}`,
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
    };

    res.json({
      isSuspicious: Boolean(result.isSuspicious),
      riskLevel: ["high", "medium", "low", "safe"].includes(result.riskLevel ?? "")
        ? result.riskLevel
        : "low",
      explanation: String(result.explanation ?? ""),
      redFlags: Array.isArray(result.redFlags) ? result.redFlags.map(String) : [],
      recommendation: String(result.recommendation ?? ""),
    });
  } catch (err) {
    req.log.error(err, "Link check failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
