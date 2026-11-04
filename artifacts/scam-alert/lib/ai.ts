import {
  analyzeScamMessage,
  analyzeScamLink,
  analyzeScamPhone,
  chatWithScamAdvisor,
} from "@workspace/api-client-react";
import { configureApi } from "./api-base";

export class AiRequestError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}

export async function aiRequest<T>(call: (options: RequestInit) => Promise<T>, timeoutMs = 60_000): Promise<T> {
  configureApi();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await call({ signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The AI request timed out. Please try again.");
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      throw new AiRequestError("AI is unavailable because the app server needs an update. Please try again later.", 404);
    }
    if (error && typeof error === "object" && "data" in error) {
      const data = error.data;
      if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
        throw new AiRequestError(data.error, "status" in error && typeof error.status === "number" ? error.status : undefined);
      }
    }
    throw new Error("Could not reach the AI service. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

export function analyzeScam(message: string) {
  return aiRequest(options => analyzeScamMessage({ message: message.trim() }, options));
}

export function checkLink(url: string) {
  return aiRequest(options => analyzeScamLink({ url: url.trim() }, options));
}

export function checkPhone(phone: string) {
  return aiRequest(options => analyzeScamPhone({ phone: phone.trim() }, options));
}

export async function chatWithScamBot(
  history: { role: string; text: string }[],
  message: string,
): Promise<string> {
  const result = await aiRequest(options => chatWithScamAdvisor({
    message: message.trim(),
    history: history.slice(-10).filter(item => item.text.trim()).map(item => ({
      role: item.role === "user" ? "user" as const : "assistant" as const,
      text: item.text.slice(0, 1500),
    })),
  }, options));
  return result.reply;
}
