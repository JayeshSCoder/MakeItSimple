const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI summaries will fail.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const getModel = () => {
  return genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) : null;
};

async function summarize(req, res) {
  const { text = "" } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Missing text field" });
  }

  const model = getModel();
  if (!model) {
    return res.status(500).json({ error: "Gemini client not configured" });
  }

  const prompt = `Summarize the following text in 3 concise bullet points:\n\n${text}`;

  try {
    const response = await model.generateContent(prompt);
    const aiText = response?.response?.text?.() ?? "";
    return res.json({ summary: aiText });
  } catch (error) {
    console.error("Gemini summarize failed", error);
    return res.status(502).json({ error: "Failed to generate summary" });
  }
}

async function explain(req, res) {
  const { text = "" } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Missing text field" });
  }

  const model = getModel();
  if (!model) {
    return res.status(500).json({ error: "Gemini client not configured" });
  }

  const prompt = `Explain the following text in simple terms (EL15 level) for a general audience. Keep it concise:\n\n${text}`;

  try {
    const response = await model.generateContent(prompt);
    const aiText = response?.response?.text?.() ?? "";
    return res.json({ explanation: aiText });
  } catch (error) {
    console.error("Gemini explain failed", error);
    return res.status(502).json({ error: "Failed to generate explanation" });
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
  const model = getModel();

  if (!model) {
    return res.status(500).json({ error: "Gemini client not configured" });
  }

  try {
    const response = await model.generateContent(prompt);
    const aiText = response?.response?.text?.() ?? "";
    return res.json({ answer: aiText });
  } catch (error) {
    console.error("Gemini chat failed", error);
    return res.status(502).json({ error: "Failed to generate answer" });
  }
}

module.exports = {
  summarize,
  explain,
  chat,
};
