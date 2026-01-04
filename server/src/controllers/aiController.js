const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI summaries will fail.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) : null;

async function summarize(req, res) {
  const { text = "" } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: "Missing text field" });
  }

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

module.exports = {
  summarize,
};
