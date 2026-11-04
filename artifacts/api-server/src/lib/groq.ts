import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

export const GROQ_MODEL = "openai/gpt-oss-20b";

export class AiServiceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// This client is server-only. No provider credentials belong in the mobile bundle.
export async function completeWithGroq(
  messages: ChatCompletionMessageParam[],
  json = false,
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new AiServiceError(503, "The AI service is not configured yet.");
  }
  const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 35_000,
    maxRetries: 1,
  });
  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.3,
      reasoning_effort: "low",
      max_completion_tokens: 4096,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text || completion.choices[0]?.finish_reason === "length") {
      throw new AiServiceError(502, "The AI response was incomplete. Please try again.");
    }
    return text;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (error instanceof Groq.APIError && error.status === 429) {
      throw new AiServiceError(429, "The free AI service is busy or has reached its quota. Please try again later.");
    }
    throw new AiServiceError(503, "The AI service is temporarily unavailable. Please try again later.");
  }
}
