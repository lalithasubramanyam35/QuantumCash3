const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const crunchPromptRegex = /prompt = `[\s\S]*?The letter should be structured with clear headings[\s\S]*?`;/;
const stablePromptRegex = /prompt = `[\s\S]*?The letter should be structured with clear headings[\s\S]*?`;/;

const newCrunchPrompt = `prompt = \`
You are an expert Virtual Treasurer AI. Based on the following financial forecast, draft a highly compelling, eye-catchy, yet professional email addressed to the CEOs of top tier banks (e.g., Jamie Dimon at JPMorgan Chase, Brian Moynihan at Bank of America, Jane Fraser at Citi).

Subject: Strategic Micro-Loan Request - Bridge Funding for [Company Name]

Our company name is [Company Name]. We are seeking a strategic $3,000.00 micro-loan to seamlessly bridge a brief cash flow timing mismatch. We want this email to stand out to a CEO, highlighting our strong fundamentals while urgently securing this small bridge.

Financial context:
- Analysis Date: July 14, 2026
- Daily sales average: $\${avgSales.toFixed(2)}
- Daily overhead average: $\${avgOverhead.toFixed(2)}
- Net positive daily operating cash flow: ~$\${(avgSales - avgOverhead).toFixed(2)}
- Cash crunch start date: \${crunchDate}
- Reason for crunch: Concentration of two scheduled obligations in close succession: Bi-weekly Payroll ($2,500.00 on July 17) and Weekly Supplier Payments ($1,200.00 on July 20).
- Estimated shortfall: $\${maxShortfall.toFixed(2)}

Make the email eye-catchy, engaging, and professional. Use formatting like bullet points or bold text to make it skimmable for a busy CEO. Include all necessary financial details clearly. Only return the text of the email. Sign it as "Gandikota Lalitha Subramanyam, Authorized Treasury Representative".
\`;`;

const newStablePrompt = `prompt = \`
You are an expert Virtual Treasurer AI. Based on the following financial forecast, draft a highly compelling, eye-catchy, yet professional email addressed to the CEOs of top tier banks (e.g., Jamie Dimon at JPMorgan Chase, Brian Moynihan at Bank of America, Jane Fraser at Citi).

Subject: Proactive Treasury Health Report & Credit Optimization - [Company Name]

Our company name is [Company Name]. We are experiencing stable growth and strong liquidity. We wish to expand our existing commercial card or line of credit buffer as a proactive treasury strategy. We want this email to stand out to a CEO, highlighting our robust financial health and offering a lucrative partnership opportunity.

Financial context:
- Analysis Date: July 14, 2026
- Daily sales average: $\${avgSales.toFixed(2)}
- Daily overhead average: $\${avgOverhead.toFixed(2)}
- Net positive daily operating cash flow: ~$\${(avgSales - avgOverhead).toFixed(2)}
- Current Liquidity Standing: Excellent, ending the 7-day projection window at $\${currentBal.toFixed(2)}.

Make the email eye-catchy, engaging, and professional. Use formatting like bullet points or bold text to make it skimmable for a busy CEO. Highlight the liquidity and cash flow strength prominently. Only return the text of the email. Sign it as "Gandikota Lalitha Subramanyam, Authorized Treasury Representative".
\`;`;

let firstMatch = true;
content = content.replace(/prompt = `[\s\S]*?`;/g, (match) => {
    if (firstMatch) {
        firstMatch = false;
        return newCrunchPrompt;
    } else {
        return newStablePrompt;
    }
});

fs.writeFileSync('server.js', content, 'utf8');
