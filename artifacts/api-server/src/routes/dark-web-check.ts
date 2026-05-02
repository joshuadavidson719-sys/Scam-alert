import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.post("/dark-web-check", async (req, res) => {
  const { email } = req.body as { email: string };

  if (!email?.trim() || !email.includes("@")) {
    return res.status(400).json({ error: "valid email is required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a cybersecurity analysis assistant. When given an email address, you simulate a realistic data breach scan result for educational purposes.

IMPORTANT: You are NOT actually scanning real breach databases. Generate a realistic educational simulation that:
1. Sometimes returns "safe" results (no breaches) - about 30% of the time
2. Sometimes returns 1-3 simulated breach entries with realistic data

Return ONLY valid JSON in this exact format:
{
  "safe": boolean,
  "breachCount": number,
  "breaches": [
    {
      "name": "Service Name",
      "date": "Month Year",
      "dataTypes": ["Email", "Password", "Phone"],
      "description": "Brief description of the breach"
    }
  ],
  "recommendations": ["Action 1", "Action 2", "Action 3"],
  "checkedAt": "ISO timestamp"
}

For recommendations, always include 3-5 practical security actions like changing passwords, enabling 2FA, monitoring credit, etc.
Use realistic breach names (e.g., LinkedIn, Adobe, Canva, Dropbox, Equifax, Yahoo, etc.)
dataTypes can include: Email, Password, Username, Phone, Address, Date of Birth, Credit Card, Social Security, IP Address`,
        },
        {
          role: "user",
          content: `Simulate a breach scan for: ${email}. Return JSON only.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw);
    result.checkedAt = new Date().toISOString();
    return res.json(result);
  } catch (err) {
    req.log.error(err, "dark-web-check error");
    return res.status(500).json({ error: "Check failed" });
  }
});

export default router;
