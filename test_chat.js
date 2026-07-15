import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('API key exists:', !!apiKey);
const ai = new GoogleGenAI({ apiKey });
const formattedMessages = [
  { role: "user", parts: [{ text: "hello" }] }
];

ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: formattedMessages,
}).then(res => console.log(res.text)).catch(e => console.error("Error:", e.message, JSON.stringify(e, null, 2)));
