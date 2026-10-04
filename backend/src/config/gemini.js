const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('GEMINI_API_KEY not set — AI features will be unavailable');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function getModel(modelName = 'gemini-2.5-flash') {
  if (!genAI) throw new Error('Gemini AI not configured — set GEMINI_API_KEY in .env');
  return genAI.getGenerativeModel({ model: modelName });
}

function getModelWithFallback() {
  if (!genAI) throw new Error('Gemini AI not configured — set GEMINI_API_KEY in .env');
  try {
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  } catch {
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
}

module.exports = { genAI, getModel, getModelWithFallback };
