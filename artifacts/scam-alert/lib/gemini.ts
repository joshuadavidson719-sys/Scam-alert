const GEMINI_API_KEY =
  typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? ""
    : "";

const BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function askGemini(prompt: string): Promise<string> {
  const key = GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key not configured");

  const res = await fetch(`${BASE_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates[0].content.parts[0].text;
}

export async function analyzeScam(message: string) {
  const prompt = `You are a scam detection expert. Analyze this message and respond ONLY with valid JSON (no markdown, no code blocks):
{"isScam":bool,"confidence":"high"|"medium"|"low","explanation":"string","redFlags":["string"],"recommendation":"string","scamType":"string or null"}

Message: "${message}"`;
  const raw = await askGemini(prompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function chatWithScamBot(
  history: { role: string; text: string }[],
  userMessage: string
): Promise<string> {
  const systemPrompt = `You are ScamBot, an AI scam prevention advisor for the Scam Alert app by SpiceTech Ltd. 
You help users identify scams, protect themselves from fraud, phishing, and online threats.
Be friendly, clear, and concise. Use bullet points for lists. Keep responses under 200 words.`;

  const conversation = history
    .map((m) => `${m.role === "user" ? "User" : "ScamBot"}: ${m.text}`)
    .join("\n");

  const prompt = `${systemPrompt}\n\nConversation so far:\n${conversation}\n\nUser: ${userMessage}\nScamBot:`;
  return askGemini(prompt);
}

export async function checkLink(url: string): Promise<{
  isSafe: boolean;
  risk: "safe" | "suspicious" | "dangerous";
  reasons: string[];
  recommendation: string;
}> {
  const prompt = `You are a cybersecurity expert. Analyze this URL for safety. Respond ONLY with valid JSON:
{"isSafe":bool,"risk":"safe"|"suspicious"|"dangerous","reasons":["string"],"recommendation":"string"}

URL: "${url}"`;
  const raw = await askGemini(prompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function checkPhone(phone: string): Promise<{
  isSuspicious: boolean;
  risk: "safe" | "suspicious" | "dangerous";
  reasons: string[];
  recommendation: string;
}> {
  const prompt = `You are a fraud detection expert. Analyze this phone number for scam risk. Respond ONLY with valid JSON:
{"isSuspicious":bool,"risk":"safe"|"suspicious"|"dangerous","reasons":["string"],"recommendation":"string"}

Phone: "${phone}"`;
  const raw = await askGemini(prompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
