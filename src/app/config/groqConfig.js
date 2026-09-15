/**
 * Centralized Groq AI Configuration & Model Management
 */

// Supported production model on Groq
export const GROQ_MODELS = {
  PRIMARY: "openai/gpt-oss-20b",
};

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

  const isRateLimit = status === 429 || message.includes("rate limit") || message.includes("rate_limit_exceeded") || isTPD || isTPM;
  const isAuthError = status === 401 || message.includes("auth") || message.includes("unauthorized") || message.includes("api key");
  const isTimeout = status === 408 || status === 504 || message.includes("timeout");

  let userMessage = "I couldn't process your request right now. Please try again later.";
  if (isRateLimit) {
    userMessage = "AI is temporarily busy. Please try again.";
  } else if (isTimeout) {
    userMessage = "The AI request timed out. Please try again.";
  } else if (isAuthError) {
    userMessage = "AI service authentication error. Please try again later.";
  }

  return {
    status,
    isRateLimit,
    isTPD,
    isTPM,
    isAuthError,
    isTimeout,
    userMessage,
  };
};

