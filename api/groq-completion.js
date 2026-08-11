import Groq from "groq-sdk";

const readJsonBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server API key is not configured." });
  }

  try {
    const body = await readJsonBody(req);
    const { messages, model, max_tokens, temperature } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const groq = new Groq({ apiKey });

    // Enable Server-Sent Events streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const stream = await groq.chat.completions.create({
      model: model || "llama-3.3-70b-versatile",
      messages,
      max_tokens: max_tokens || 2048,
      temperature: typeof temperature === "number" ? temperature : 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("[groq-completion-api]", error);
    
    // Categorize error status & message safely
    const status = error?.status || 500;
    const rawMsg = String(error?.message || "");

    let safeErrorType = "server_error";
    if (status === 429 || rawMsg.includes("rate limit")) {
      safeErrorType = rawMsg.includes("tokens per day") || rawMsg.includes("TPD")
        ? "tpd_limit_exceeded"
        : "tpm_limit_exceeded";
    } else if (status === 400 && (rawMsg.includes("decommissioned") || rawMsg.includes("deprecated"))) {
      safeErrorType = "model_decommissioned";
    }

    if (!res.headersSent) {
      return res.status(status).json({
        error: "AI Generation Error",
        errorType: safeErrorType,
        statusCode: status,
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error", errorType: safeErrorType })}\n\n`);
      res.end();
    }
  }
}
