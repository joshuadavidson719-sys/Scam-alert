// Compatibility exports for older screens. All requests now go to Scam Alert's
// authenticated Groq-backed API; no Gemini endpoint or client key is used.
export { analyzeScam, chatWithScamBot, checkLink, checkPhone } from "./ai";
