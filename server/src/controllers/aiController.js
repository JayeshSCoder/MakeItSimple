const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI summaries will fail.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MAX_RETRIES = parseInt(process.env.GEMINI_MAX_RETRIES || "3", 10);
const INITIAL_BACKOFF_MS = parseInt(process.env.GEMINI_BACKOFF_MS || "800", 10);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getModel = () => {
  return genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) : null;
};

const extractStatus = (error) => error?.response?.status || error?.status || error?.code || null;

async function generateWithRetry(prompt) {
  const model = getModel();
  if (!model) {
    throw new Error("Gemini client not configured");
  }

  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await model.generateContent(prompt);
      return response?.response?.text?.() ?? "";
    } catch (error) {
      const status = extractStatus(error);
      const shouldRetry = (status === 429 || status === 503) && attempt < MAX_RETRIES - 1;

      if (!shouldRetry) {
        error.__status = status || 500;
        throw error;
      }

      attempt += 1;
      await delay(backoff);
      backoff *= 2;
    }
  }
}

async function summarize(req, res) {
  const { text = "" } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Missing text field" });
  }

  const prompt = `Summarize the following text in 3 concise bullet points:\n\n${text}`;

  try {
    const aiText = await generateWithRetry(prompt);
    return res.json({ summary: aiText });
  } catch (error) {
    const status = error.__status || extractStatus(error) || 502;
    console.error("Gemini summarize failed", error);
    if (error.message === "Gemini client not configured") {
      return res.status(500).json({ error: error.message });
    }
    const message = status === 429 ? "AI is receiving too many requests. Please try again in a moment." : "Failed to generate summary";
    return res.status(status === 429 ? 429 : 502).json({ error: message });
  }
}

async function explain(req, res) {
  const { text = "" } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Missing text field" });
  }

  const prompt = `Explain the following text in simple terms (EL15 level) for a general audience. Keep it concise:\n\n${text}`;

  try {
    const aiText = await generateWithRetry(prompt);
    return res.json({ explanation: aiText });
  } catch (error) {
    const status = error.__status || extractStatus(error) || 502;
    console.error("Gemini explain failed", error);
    if (error.message === "Gemini client not configured") {
      return res.status(500).json({ error: error.message });
    }
    const message = status === 429 ? "AI is receiving too many requests. Please try again in a moment." : "Failed to generate explanation";
    return res.status(status === 429 ? 429 : 502).json({ error: message });
  }
}

async function chat(req, res) {
  const { question = "", context = "" } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: "Missing question field" });
  }

  if (!context) {
    return res.status(400).json({ error: "Missing context field" });
  }

  const prompt = `Context: ${context}\n\nQuestion: ${question}\n\nAnswer the question based on the context above.`;

  try {
    const aiText = await generateWithRetry(prompt);
    return res.json({ answer: aiText });
  } catch (error) {
    const status = error.__status || extractStatus(error) || 502;
    console.error("Gemini chat failed", error);
    if (error.message === "Gemini client not configured") {
      return res.status(500).json({ error: error.message });
    }
    const message = status === 429 ? "AI is receiving too many requests. Please try again in a moment." : "Failed to generate answer";
    return res.status(status === 429 ? 429 : 502).json({ error: message });
  }
}

module.exports = {
  summarize,
  explain,
  chat,
};
