export const handler = async (event, context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: "GEMINI_API_KEY environment variable is not set in Netlify." })
    };
  }

  const forecastData = {
    analysisDate: '2026-07-14',
    currentBalance: 456.20,
    patterns: [
      { name: '[Daily] Sales', desc: 'Avg Inflow: $242.45/day' },
      { name: '[Daily] Overhead', desc: 'Avg Outflow: $85.80/day' },
      { name: '[Weekly] Suppliers', desc: 'Avg Outflow: $1,200.00 (Every 7 days)' },
      { name: '[Weekly] Utilities', desc: 'Avg Outflow: $150.00 (Every 7 days)' },
      { name: '[Bi-weekly] Payroll', desc: 'Avg Outflow: $2,500.00 (Every 14 days)' }
    ],
    projection: [
      { day: 'T+1', date: '2026-07-15', start: 456.20, in: 242.45, out: 235.80, end: 462.85, events: 'Utilities' },
      { day: 'T+2', date: '2026-07-16', start: 462.85, in: 242.45, out: 85.80, end: 619.50, events: 'None' },
      { day: 'T+3', date: '2026-07-17', start: 619.50, in: 242.45, out: 2585.80, end: -1723.85, events: 'Payroll' },
      { day: 'T+4', date: '2026-07-18', start: -1723.85, in: 242.45, out: 85.80, end: -1567.19, events: 'None' },
      { day: 'T+5', date: '2026-07-19', start: -1567.19, in: 242.45, out: 85.80, end: -1410.54, events: 'None' },
      { day: 'T+6', date: '2026-07-20', start: -1410.54, in: 242.45, out: 1285.80, end: -2453.89, events: 'Suppliers' },
      { day: 'T+7', date: '2026-07-21', start: -2453.89, in: 242.45, out: 85.80, end: -2297.24, events: 'None' }
    ],
    warning: {
      date: '2026-07-17',
      shortfall: 1723.85
    }
  };

  try {
    const prompt = `
You are an expert Virtual Treasurer AI. Based on the following financial forecast, write a highly professional, math-backed short-term working capital micro-loan request letter to a bank ([Bank Name]).

Our company name is [Company Name]. We need a $3,000.00 micro-loan to bridge a cash flow timing mismatch.

Financial context:
- Analysis Date: July 14, 2026
- Daily sales average: $242.45
- Daily overhead average: $85.80
- Net positive daily operating cash flow: ~$156.65
- Cash crunch start date: July 17, 2026
- Reason for crunch: Concentration of two scheduled obligations in close succession: Bi-weekly Payroll ($2,500.00 on July 17) and Weekly Supplier Payments ($1,200.00 on July 20).
- Estimated shortfall: $1,723.85

The letter should be structured with clear headings like "Context & Financial Analysis", "Cause of the Cash Flow Gap", and "Loan Details & Repayment Strategy". Keep it objective, precise, and professional. Only return the text of the letter.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    forecastData.loanLetter = data.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate letter.";
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(forecastData)
    };
  } catch (error) {
    console.warn("Gemini API Warning:", error.message);
    forecastData.loanLetter = `[Mock Generated Letter - API Error Encountered]\n\nDear [Bank Name],\n\nContext & Financial Analysis\nWe are [Company Name]. Based on our recent financial analysis (as of July 14, 2026), our business is experiencing a net positive daily operating cash flow of ~$156.65, with average daily sales of $242.45 and overhead of $85.80.\n\nCause of the Cash Flow Gap\nWe are expecting a short-term cash crunch starting July 17, 2026. This is due to the concentration of two scheduled obligations: a bi-weekly payroll of $2,500.00 and weekly supplier payments of $1,200.00. This timing mismatch will result in an estimated shortfall of $1,723.85.\n\nLoan Details & Repayment Strategy\nWe are requesting a $3,000.00 micro-loan to bridge this gap. Our consistent daily positive cash flow will allow us to repay this loan promptly once the timing mismatch resolves.\n\nThank you for your consideration.`;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(forecastData)
    };
  }
};
