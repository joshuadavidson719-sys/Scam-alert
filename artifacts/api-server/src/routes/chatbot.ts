import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.post("/chatbot", async (req, res) => {
  const { message, history = [] } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are ScamBot, an expert AI assistant specializing in scam prevention, fraud detection, and cybersecurity awareness. You help users identify scams, protect themselves from fraud, and know what to do if they've been victimized.

Your expertise covers:
- Phishing emails, SMS smishing, and voice vishing attacks
- Romance scams, catfishing, and social engineering
- Investment fraud, crypto scams, and Ponzi schemes
- Tech support scams and remote access fraud
- Identity theft and data breach recovery
- Government impersonation scams (IRS, SSA, Medicare)
- Online shopping fraud and counterfeit goods
- Employment scams and work-from-home fraud
- Lottery/prize scams and advance-fee fraud
- How to report scams to authorities (FTC, FBI IC3, etc.)

Be concise, practical, and actionable. Use bullet points for lists. Include specific red flags and warning signs. Always encourage reporting to authorities. Be empathetic — many scam victims feel embarrassed. Never share or ask for personal information.`,
        },
        ...history.slice(-10),
        { role: "user", content: message },
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content ?? "I couldn't process that. Please try again.";
    return res.json({ reply });
  } catch (err) {
    req.log.error(err, "chatbot error");
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

export default router;
