import https from 'https';

// Safe fetch utility supporting old Node versions
async function safeFetch(url, options = {}) {
  if (typeof fetch !== 'undefined') {
    return fetch(url, options);
  }
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      port: 443
    };
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });
    req.on('error', (err) => { reject(err); });
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isInvalidKey = !apiKey || apiKey.startsWith('YOUR_') || apiKey === 'placeholder' || apiKey === 'undefined';

  if (isInvalidKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: "I'm the QuantumCash Virtual Assistant! My AI engine is currently offline or unconfigured on Netlify, but I can still help you navigate the secure banking portal!" })
    };
  }

  try {
    const { messages } = JSON.parse(event.body);
    
    const systemPrompt = "You are the QuantumCash Virtual Assistant, a helpful AI assistant for a secure banking portal. Be concise and professional.";
    const formattedMessages = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I am the QuantumCash Virtual Assistant." }] },
      ...messages
    ];

    const response = await safeFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedMessages
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that request.";

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.warn("Chat API Warning:", error.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: "[Mock Response - API Error Encountered] I'm a virtual assistant here to help you with your banking needs. (Please check your Gemini API key.)" })
    };
  }
};
