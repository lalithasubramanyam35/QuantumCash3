import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let __filename = '';
let __dirname = '';
try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  console.warn("Could not determine __dirname via fileURLToPath:", e.message);
}

// CSV Parser helper (100% synchronous & robust)
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

// Find files robustly across different path strategies in serverless environment
function getFilePath(scenario) {
  const fileName = `ledger_${scenario}.csv`;
  const candidates = [
    path.join(process.cwd(), fileName),
    path.join(process.cwd(), 'src', fileName),
    path.join(process.cwd(), 'netlify', 'functions', fileName),
    path.join('/var/task', fileName),
    path.join('/var/task/netlify/functions', fileName),
    path.join('/var/task/src', fileName)
  ];
  
  if (__dirname) {
    candidates.push(
      path.join(__dirname, `../../${fileName}`),
      path.join(__dirname, `..`, `..`, fileName),
      path.join(__dirname, fileName)
    );
  }
  
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch (e) {
      console.warn(`Error checking candidate path ${c}:`, e.message);
    }
  }
  return null;
}

export const handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  const scenario = params.scenario === 'crunch' ? 'crunch' : 'stable';
  const filePath = getFilePath(scenario);
  
  if (!filePath) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Ledger CSV file not found for scenario: ${scenario}` })
    };
  }
  
  try {
    const { transactions, finalBalance } = parseLedgerCSV(filePath);
    let filtered = [...transactions];
    
    // Reverse chronological order (newest first)
    filtered.reverse();
    
    if (params.category) {
      filtered = filtered.filter(t => t.category.toLowerCase() === params.category.toLowerCase());
    }
    if (params.type) {
      filtered = filtered.filter(t => t.type.toLowerCase() === params.type.toLowerCase());
    }
    
    const totalCount = filtered.length;
    const limit = parseInt(params.limit) || totalCount;
    const offset = parseInt(params.offset) || 0;
    const paginated = filtered.slice(offset, offset + limit);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        scenario,
        totalCount,
        limit,
        offset,
        finalBalance,
        transactions: paginated
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to parse ledger file: ${error.message}` })
    };
  }
};
