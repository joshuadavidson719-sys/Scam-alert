import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.post("/scam-check", async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are an expert scam detection AI. Analyze the provided message and determine if it is likely a scam. 

Respond with a JSON object with these exact fields:
- isScam: boolean
- confidence: "high" | "medium" | "low" 
- explanation: string (2-3 sentences explaining your analysis)
- redFlags: string[] (list of specific red flags found, empty array if none)
- recommendation: string (1-2 sentences of advice for the user)

Common scam patterns to look for: urgency tactics, prize/lottery wins, requests for personal info, suspicious links, too-good-to-be-true offers, impersonation of legitimate organizations, threatening language, poor grammar/spelling as deception, unsolicited contact, cryptocurrency or wire transfer requests.

Always respond with valid JSON only, no other text.`,
        },
        {
          role: "user",
          content: `Analyze this message for scam indicators:\n\n"${message.trim()}"`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content) as {
      isScam: boolean;
      confidence: "high" | "medium" | "low";
      explanation: string;
      redFlags: string[];
      recommendation: string;
    };

    res.json(result);
  } catch (err) {
    req.log.error(err, "Scam check failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
