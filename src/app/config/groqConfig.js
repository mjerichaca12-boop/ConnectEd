/**
 * Centralized Groq AI Configuration & Model Management
 */

// Supported production models on Groq
export const GROQ_MODELS = {
  PRIMARY: "llama-3.1-8b-instant",
  FALLBACK_1: "llama-3.3-70b-versatile",
};

// Maximum retry attempts per user request (Primary -> Fallback 1 -> Stop)
export const MAX_AI_ATTEMPTS = 2;

// Token & Context Budgets
export const MAX_TOKENS = 1500;
export const MAX_TOTAL_FILE_CHARS = 3500; // ~800 tokens max context for documents
export const MAX_HISTORY_MESSAGES = 3;    // Keep last 3 messages to limit input tokens

/**
 * Categorize Groq errors safely without exposing raw API objects
 */
export const parseGroqError = (error) => {
  const status = error?.status || error?.statusCode || 500;
  const message = String(error?.message || error?.errorType || "").toLowerCase();

  const isTPD = message.includes("tpd_limit_exceeded") || 
                message.includes("tokens per day") || 
                message.includes("tpd");

  const isTPM = message.includes("tpm_limit_exceeded") || 
                message.includes("tokens per minute") || 
                message.includes("tpm");

  const isRateLimit = status === 429 || message.includes("rate limit") || isTPD || isTPM;

  const isDecommissioned = status === 400 && (
    message.includes("decommissioned") || 
    message.includes("model_decommissioned") || 
    message.includes("deprecated")
  );

  return {
    status,
    isRateLimit,
    isTPD,
    isTPM,
    isDecommissioned,
    userMessage: isTPD
      ? "AI usage limit has been reached temporarily. Please try again later."
      : isTPM
      ? "AI service is currently busy. Retrying momentarily..."
      : isRateLimit
      ? "AI usage limit reached. Please wait a moment before trying again."
      : "I couldn't process your request right now. Please try again later.",
  };
};
