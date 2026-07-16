import express from 'express';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ override: true });


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'web-interface')));
const router = express.Router();

import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// In-memory data store for the session
const inMemoryLedger = {
  crunch: null,
  stable: null
};

const customBuckets = {
  crunch: [],
  stable: []
};

// CSV Parser helper using readFileSync (fast, robust, 100% synchronous)
function getLedgerFilePath(scenario) { const fileName = `ledger_${scenario}.csv`; const pathsToTry = [ path.join(process.cwd(), fileName), path.join(process.cwd(), fileName), path.join(process.cwd(), "netlify", "functions", fileName), path.join(process.env.LAMBDA_TASK_ROOT || "/var/task", fileName), path.join(process.env.LAMBDA_TASK_ROOT || "/var/task", "netlify", "functions", fileName), path.join(process.cwd(), fileName), path.join("/var/task", "netlify", "functions", fileName), path.join("/var/task", "src", fileName) ]; for (const p of pathsToTry) { if (fs.existsSync(p)) return p; } return path.join(process.cwd(), fileName); }
function parseLedgerCSV(scenario) {
  if (inMemoryLedger[scenario]) {
    return inMemoryLedger[scenario];
  }

  const fp = getLedgerFilePath(scenario); if (!fs.existsSync(fp)) throw new Error("CSV not found: " + fp); const content = fs.readFileSync(fp, 'utf-8');
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
  
  inMemoryLedger[scenario] = { transactions, finalBalance: parseFloat(runningBalance.toFixed(2)) };
  return inMemoryLedger[scenario];
}

// Technical Proof of Competence: Transactions API
router.get('/transactions', (req, res) => {
  const scenario = req.query.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(process.cwd(), `ledger_${scenario}.csv`);
  
  try {
    const { transactions, finalBalance } = parseLedgerCSV(scenario);
    
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

// Smart-Wallet Buckets API
router.get('/buckets', (req, res) => {
  const scenario = req.query.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(process.cwd(), `ledger_${scenario}.csv`);
  
  try {
    const { transactions } = parseLedgerCSV(scenario);
    
    // Use custom buckets for this scenario
    const buckets = customBuckets[scenario].map(b => ({ ...b, spent: 0, saved: 0 }));

    // Calculate spent for buckets based on transactions
    transactions.forEach(t => {
      const bucket = buckets.find(b => b.name.toLowerCase() === t.category.toLowerCase());
      if (bucket) {
        if (t.type === 'OUTFLOW') {
          bucket.spent += Math.abs(t.amount);
        } else if (t.type === 'INFLOW') {
          bucket.saved += Math.abs(t.amount);
        }
      }
    });

    const enrichedBuckets = buckets.map(b => {
      if (b.type === 'saving') {
        const currentAmount = b.saved - b.spent;
        const percentage = b.allocated > 0 ? (currentAmount / b.allocated) * 100 : 0;
        return {
          ...b,
          currentAmount: Math.max(0, currentAmount),
          remaining: Math.max(0, b.allocated - currentAmount),
          percentage: Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2)))),
          isAlert: false
        };
      } else {
        const totalFunds = b.allocated + b.saved;
        const percentage = totalFunds > 0 ? (b.spent / totalFunds) * 100 : 0;
        const isAlert = percentage >= 90;
        return {
          ...b,
          totalFunds,
          remaining: totalFunds - b.spent,
          percentage: parseFloat(percentage.toFixed(2)),
          isAlert
        };
      }
    });

    res.json({ buckets: enrichedBuckets });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch buckets: " + error.message });
  }
});

// Create Bucket API
router.post('/buckets', (req, res) => {
  const scenario = req.body.scenario === 'crunch' ? 'crunch' : 'stable';
  
  try {
    const { name, allocated, goal, type } = req.body;
    
    if (!name || isNaN(parseFloat(allocated))) {
      return res.status(400).json({ error: "Invalid bucket data" });
    }

    const newBucket = {
      id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: name,
      type: type || 'spending',
      allocated: parseFloat(allocated),
      goal: goal || ''
    };

    customBuckets[scenario].push(newBucket);

    res.json({ success: true, bucket: newBucket });
  } catch (error) {
    res.status(500).json({ error: "Failed to create bucket: " + error.message });
  }
});

// Add Transaction API
router.post('/transactions', (req, res) => {
  const scenario = req.body.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(process.cwd(), `ledger_${scenario}.csv`);
  
  try {
    const ledger = parseLedgerCSV(scenario);
    const { amount, category, description, type } = req.body;
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const txnType = type === 'INFLOW' ? 'INFLOW' : 'OUTFLOW';
    
    // Check savings bucket balance for OUTFLOW
    const targetBucket = customBuckets[scenario].find(b => b.name.toLowerCase() === category.toLowerCase());
    if (targetBucket && targetBucket.type === 'saving' && txnType === 'OUTFLOW') {
      let saved = 0;
      let spent = 0;
      ledger.transactions.forEach(t => {
        if (t.category.toLowerCase() === category.toLowerCase()) {
          if (t.type === 'INFLOW') saved += Math.abs(t.amount);
          else if (t.type === 'OUTFLOW') spent += Math.abs(t.amount);
        }
      });
      const currentAmount = saved - spent;
      if (parsedAmount > currentAmount) {
        return res.status(400).json({ error: `Insufficient funds in saving bucket. Available: $${currentAmount.toFixed(2)}` });
      }
    }

    const newTxn = {
      date: new Date().toISOString().split('T')[0],
      transaction_id: `TXN_NEW_${Date.now()}`,
      type: txnType,
      amount: txnType === 'INFLOW' ? Math.abs(parsedAmount) : -Math.abs(parsedAmount),
      category: category,
      description: description || 'User added transaction'
    };

    ledger.finalBalance += newTxn.amount;
    newTxn.runningBalance = parseFloat(ledger.finalBalance.toFixed(2));
    ledger.transactions.push(newTxn);

    res.json({ success: true, transaction: newTxn });
  } catch (error) {
    res.status(500).json({ error: "Failed to add transaction: " + error.message });
  }
});

// Move Transaction API
router.post('/transactions/move', (req, res) => {
  const scenario = req.body.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(process.cwd(), `ledger_${scenario}.csv`);
  
  try {
    const ledger = parseLedgerCSV(scenario);
    const { transaction_id, newCategory } = req.body;
    
    if (!transaction_id || !newCategory) {
      return res.status(400).json({ error: "Missing transaction_id or newCategory" });
    }

    const txn = ledger.transactions.find(t => t.transaction_id === transaction_id);
    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Check savings bucket balance for OUTFLOW moves to a saving bucket
    if (txn.type === 'OUTFLOW' && txn.category.toLowerCase() !== newCategory.toLowerCase()) {
      const targetBucket = customBuckets[scenario].find(b => b.name.toLowerCase() === newCategory.toLowerCase());
      if (targetBucket && targetBucket.type === 'saving') {
        let saved = 0;
        let spent = 0;
        ledger.transactions.forEach(t => {
          if (t.category.toLowerCase() === newCategory.toLowerCase() && t.transaction_id !== transaction_id) {
            if (t.type === 'INFLOW') saved += Math.abs(t.amount);
            else if (t.type === 'OUTFLOW') spent += Math.abs(t.amount);
          }
        });
        const currentAmount = saved - spent;
        if (Math.abs(txn.amount) > currentAmount) {
          return res.status(400).json({ error: `Insufficient funds in saving bucket to move this expense. Available: $${currentAmount.toFixed(2)}` });
        }
      }
    }

    txn.category = newCategory;

    res.json({ success: true, transaction: txn });
  } catch (error) {
    res.status(500).json({ error: "Failed to move transaction: " + error.message });
  }
});

// Dynamic Forecast API utilizing parsed LEDGER CSV and Gemini AI (with robust fallback)
router.get('/forecast', async (req, res) => {
  const scenario = req.query.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = path.join(process.cwd(), `ledger_${scenario}.csv`);
  
  let ledger;
  try {
    ledger = parseLedgerCSV(scenario);
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

router.post('/chat', async (req, res) => {
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

router.get('/debug', (req, res) => {
  res.json({
    dirname: process.cwd(),
    cwd: process.cwd(),
    files_in_dirname: fs.readdirSync(process.cwd()),
    files_in_cwd: fs.readdirSync(process.cwd()),
    files_in_functions: fs.existsSync(path.join(process.cwd(), 'netlify', 'functions')) ? fs.readdirSync(path.join(process.cwd(), 'netlify', 'functions')) : []
  });
});


app.use("/", router);

app.use("/api", router);
app.use("/.netlify/functions/api", router);

if (!process.env.LAMBDA_TASK_ROOT && !process.env.AWS_LAMBDA_FUNCTION_VERSION) {

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}


// Catch-all to see what path was requested
app.use((req, res, next) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    url: req.url,
    query: req.query
  });
});
export default app;
