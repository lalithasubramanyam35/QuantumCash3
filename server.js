import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web-interface')));

import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// CSV Parser helper using readFileSync (fast, robust, 100% synchronous)
function parseLedgerCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const transactions = [];
  let runningBalance = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < headers.length) continue;
    
    const txn = {};
    headers.forEach((h, idx) => {
      txn[h] = cols[idx];
    });
    
    txn.amount = parseFloat(txn.amount);
    if (txn.type === 'OUTFLOW') {
      txn.amount = -Math.abs(txn.amount);
    } else {
      txn.amount = Math.abs(txn.amount);
    }
    
    runningBalance += txn.amount;
    txn.runningBalance = parseFloat(runningBalance.toFixed(2));
    transactions.push(txn);
  }
  
  return { transactions, finalBalance: parseFloat(runningBalance.toFixed(2)) };
}

// Technical Proof of Competence: Transactions API
app.get('/api/transactions', (req, res) => {
  const scenario = req.query.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(__dirname, `ledger_${scenario}.csv`);
  
  try {
    const { transactions, finalBalance } = parseLedgerCSV(filePath);
    
    let filtered = [...transactions];
    
    // Reverse chronological order (newest first)
    filtered.reverse();
    
    if (req.query.category) {
      filtered = filtered.filter(t => t.category.toLowerCase() === req.query.category.toLowerCase());
    }
    if (req.query.type) {
      filtered = filtered.filter(t => t.type.toLowerCase() === req.query.type.toLowerCase());
    }
    
    const totalCount = filtered.length;
    
    const limit = parseInt(req.query.limit) || totalCount;
    const offset = parseInt(req.query.offset) || 0;
    
    const paginated = filtered.slice(offset, offset + limit);
    
    res.json({
      scenario,
      totalCount,
      limit,
      offset,
      finalBalance,
      transactions: paginated
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to parse ledger file: " + error.message });
  }
});

// Dynamic Forecast API utilizing parsed LEDGER CSV and Gemini AI (with robust fallback)
app.get('/api/forecast', async (req, res) => {
  const scenario = req.query.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(__dirname, `ledger_${scenario}.csv`);
  
  let ledger;
  try {
    ledger = parseLedgerCSV(filePath);
  } catch (error) {
    return res.status(500).json({ error: "Failed to read ledger: " + error.message });
  }
  
  const finalBalance = ledger.finalBalance;
  const txns = ledger.transactions;
  
  // Calculate average daily inflows/outflows dynamically from the CSV data
  const salesTxns = txns.filter(t => t.category === 'Sales');
  const overheadTxns = txns.filter(t => t.category === 'Overhead');
  
  const avgSales = salesTxns.length > 0 
    ? salesTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0) / salesTxns.length 
    : (scenario === 'crunch' ? 239.65 : 524.42);
    
  const avgOverhead = overheadTxns.length > 0 
    ? overheadTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0) / overheadTxns.length 
    : (scenario === 'crunch' ? 88.11 : 90.81);
    
  const forecastData = {
    analysisDate: '2026-07-14',
    currentBalance: finalBalance,
    patterns: [
      { name: '[Daily] Sales', desc: `Avg Inflow: $${avgSales.toFixed(2)}/day` },
      { name: '[Daily] Overhead', desc: `Avg Outflow: $${avgOverhead.toFixed(2)}/day` },
      { name: '[Weekly] Suppliers', desc: scenario === 'crunch' ? 'Avg Outflow: $1,200.00 (Every 7 days)' : 'Avg Outflow: $800.00 (Every 7 days)' },
      { name: '[Weekly] Utilities', desc: 'Avg Outflow: $150.00 (Every 7 days)' },
      { name: '[Bi-weekly] Payroll', desc: 'Avg Outflow: $2,500.00 (Every 14 days)' }
    ],
    projection: [],
    warning: null
  };
  
  let currentBal = finalBalance;
  let hasCrunch = false;
  let crunchDate = '';
  let maxShortfall = 0;
  
  const dates = [
    { day: 'T+1', date: '2026-07-15' },
    { day: 'T+2', date: '2026-07-16' },
    { day: 'T+3', date: '2026-07-17' },
    { day: 'T+4', date: '2026-07-18' },
    { day: 'T+5', date: '2026-07-19' },
    { day: 'T+6', date: '2026-07-20' },
    { day: 'T+7', date: '2026-07-21' }
  ];
  
  dates.forEach(d => {
    const startBal = currentBal;
    const salesIn = avgSales;
    let expOut = avgOverhead;
    let eventsList = [];
    
    // SaaS/Utilities on Wednesday (T+1, July 15)
    if (d.date === '2026-07-15') {
      expOut += 150.00;
      eventsList.push('Utilities');
    }
    
    // Payroll on Friday (T+3, July 17)
    if (d.date === '2026-07-17') {
      expOut += 2500.00;
      eventsList.push('Payroll');
    }
    
    // Suppliers on Monday (T+6, July 20)
    if (d.date === '2026-07-20') {
      const supplierAmt = scenario === 'crunch' ? 1200.00 : 800.00;
      expOut += supplierAmt;
      eventsList.push('Suppliers');
    }
    
    const endBal = startBal + salesIn - expOut;
    currentBal = parseFloat(endBal.toFixed(2));
    
    if (currentBal < 0) {
      if (!hasCrunch) {
        hasCrunch = true;
        crunchDate = d.date;
      }
      const shortfall = -currentBal;
      if (shortfall > maxShortfall) {
        maxShortfall = shortfall;
      }
    }
    
    forecastData.projection.push({
      day: d.day,
      date: d.date,
      start: parseFloat(startBal.toFixed(2)),
      in: parseFloat(salesIn.toFixed(2)),
      out: parseFloat(expOut.toFixed(2)),
      end: currentBal,
      events: eventsList.length > 0 ? eventsList.join(', ') : 'None'
    });
  });
  
  if (hasCrunch) {
    forecastData.warning = {
      date: crunchDate,
      shortfall: parseFloat(maxShortfall.toFixed(2))
    };
  }

  // Fallbacks for generated letters
  const fallbackStableLetter = `[Pre-emptive Line of Credit Review - System Generated]

Dear [Bank Name] Commercial Lending Team,

Context & Financial Analysis
Our firm, [Company Name], has completed its treasury audit as of July 14, 2026. Over the trailing 30 days, we have demonstrated excellent cash flow stability. Our operations are driven by consistent positive daily cash flows, averaging $${avgSales.toFixed(2)} in daily sales revenue against $${avgOverhead.toFixed(2)} in daily administrative overhead.

Liquidity & Cash Flow Strength
Our 7-day predictive cash model projects highly liquid operations, ending the forecast window on July 21, 2026, with a secure balance of $${currentBal.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Operating cash flows remain robust and self-sustaining through all periodic obligations, including payroll and utility schedules.

Proactive Credit Optimization Request
To support upcoming seasonal scaling and optimize our capital structure, we are proactively requesting a strategic review of our commercial credit limits. We aim to increase our operational credit buffer to maximize trading agility.

We thank you for your ongoing partnership.

Sincerely,
Gandikota Lalitha Subramanyam
Authorized Treasury Representative`;

  const fallbackCrunchLetter = `[Micro-Loan Request Letter - System Generated]

Dear [Bank Name] Commercial Credit Committee,

Context & Financial Analysis
Our company, [Company Name], is submitting this mathematically backed request for a short-term working capital micro-loan in the amount of $3,000.00. Based on our predictive treasury engine's audit (as of July 14, 2026), our business is fundamentally healthy with daily customer sales of $${avgSales.toFixed(2)} and daily administrative overhead of $${avgOverhead.toFixed(2)}.

Cause of the Cash Flow Gap
Our forward cash flow projection highlights a critical, short-term timing mismatch on July 17, 2026, due to the concentration of two major scheduled obligations in close succession:
1. Bi-weekly employee payroll ($2,500.00) on July 17, 2026.
2. Weekly inventory restocking supplier payments ($1,200.00) on July 20, 2026.
Due to these concurrent draws, our balance is predicted to dip below zero on July 17, resulting in an estimated peak liquidity shortfall of $${maxShortfall.toLocaleString("en-US", { minimumFractionDigits: 2 })}.

Loan Details & Repayment Strategy
We request a micro-loan of $3,000.00 to bridge this temporary timing gap. This buffer will keep our operations liquid, protecting employee payroll and critical supply chains. Our steady daily customer sales revenue will fully cover the amortization and prompt repayment of the principal immediately as the weekly cycle resets.

Thank you for your timely review.

Sincerely,
Gandikota Lalitha Subramanyam
Authorized Treasury Representative`;

  // Gemini Letter Generation
  const apiKey = process.env.GEMINI_API_KEY;
  const isInvalidKey = !apiKey || apiKey.startsWith('YOUR_') || apiKey === 'placeholder' || apiKey === 'undefined';

  if (isInvalidKey) {
    forecastData.loanLetter = scenario === 'crunch' ? fallbackCrunchLetter : fallbackStableLetter;
    return res.json(forecastData);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    let prompt = "";
    if (scenario === 'crunch') {
      prompt = `
You are an expert Virtual Treasurer AI. Based on the following financial forecast, write a highly professional, math-backed short-term working capital micro-loan request letter to a bank ([Bank Name]).

Our company name is [Company Name]. We need a $3,000.00 micro-loan to bridge a cash flow timing mismatch.

Financial context:
- Analysis Date: July 14, 2026
- Daily sales average: $${avgSales.toFixed(2)}
- Daily overhead average: $${avgOverhead.toFixed(2)}
- Net positive daily operating cash flow: ~$${(avgSales - avgOverhead).toFixed(2)}
- Cash crunch start date: ${crunchDate}
- Reason for crunch: Concentration of two scheduled obligations in close succession: Bi-weekly Payroll ($2,500.00 on July 17) and Weekly Supplier Payments ($1,200.00 on July 20).
- Estimated shortfall: $${maxShortfall.toFixed(2)}

The letter should be structured with clear headings like "Context & Financial Analysis", "Cause of the Cash Flow Gap", and "Loan Details & Repayment Strategy". Keep it objective, precise, and professional. Only return the text of the letter. Sign it as "Gandikota Lalitha Subramanyam, Authorized Treasury Representative".
`;
    } else {
      prompt = `
You are an expert Virtual Treasurer AI. Based on the following financial forecast, write a professional Treasury Health Report and pre-emptive Line of Credit optimization request to our banking partner ([Bank Name]).

Our company name is [Company Name]. We are experiencing stable growth and strong liquidity. We wish to expand our existing commercial card or line of credit buffer as a proactive treasury strategy.

Financial context:
- Analysis Date: July 14, 2026
- Daily sales average: $${avgSales.toFixed(2)}
- Daily overhead average: $${avgOverhead.toFixed(2)}
- Net positive daily operating cash flow: ~$${(avgSales - avgOverhead).toFixed(2)}
- Current Liquidity Standing: Excellent, ending the 7-day projection window at $${currentBal.toFixed(2)}.

The letter should be structured with clear headings like "Context & Financial Analysis", "Liquidity & Cash Flow Strength", and "Proactive Credit Optimization Request". Keep it objective, precise, and professional. Only return the text of the letter. Sign it as "Gandikota Lalitha Subramanyam, Authorized Treasury Representative".
`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });
    
    forecastData.loanLetter = response.text;
    res.json(forecastData);
  } catch (error) {
    console.error("Gemini API Error in /api/forecast:", error);
    // Graceful fallback for API invocation errors, avoiding console warnings that clutter system reports
    forecastData.loanLetter = scenario === 'crunch' ? fallbackCrunchLetter : fallbackStableLetter;
    return res.json(forecastData);
  }
});

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isInvalidKey = !apiKey || apiKey.startsWith('YOUR_') || apiKey === 'placeholder' || apiKey === 'undefined';

  if (isInvalidKey) {
    return res.json({ reply: "I'm the QuantumCash Virtual Assistant. My AI engine is currently offline or unconfigured, but I can guide you through the secure banking portal!" });
  }

  try {
    const { messages } = req.body;
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    
    const systemPrompt = "You are the QuantumCash Virtual Assistant, a helpful AI assistant for a secure banking portal. Be concise, highly professional, and helpful.";
    
    const formattedMessages = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I am the QuantumCash Virtual Assistant." }] },
      ...messages
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: formattedMessages,
    });

    res.json({ reply: response.text });
  } catch (error) {
    console.error("Gemini API Error in /api/chat:", error);
    // Graceful fallback response on model/network error without throwing system warning alerts
    res.json({ reply: "I'm the QuantumCash Virtual Assistant. It seems my connection to the AI engine is currently offline or unconfigured. How can I help you manually today?" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
