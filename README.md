# QuantumCash: AI-Powered Cash Flow Forecaster & Manager

## 💡 The Pitch (The Hook)
"Imagine a weather forecast app, but for a business's bank account. Instead of telling you it's going to rain, our system predicts exactly when your business will run out of money, helps you budget proactively, and then automatically writes a letter to the bank to get you a raincoat!"

### 📋 The 3-Step Explanation

**1. The Problem 📉**
Most small businesses don't fail because they are bad. They fail because of bad timing. For example, you have to pay your suppliers and payroll on Monday, but your customers don't pay you until Friday. That tiny gap can shut a business down. Furthermore, lacking dedicated reserves makes these gaps even more dangerous.

**2. The Prediction & Allocation 🔮**
Our engine acts as a Virtual Treasurer. It reads daily transactions and forecasts cash flow into the future, flagging the exact date the balance will dip below zero. But it doesn't stop at prediction—it introduces an intelligent **Bucket System**. You can allocate funds into dedicated *Spending Budgets* (for operational costs) and *Savings Goals* (for reserves), ensuring your money is purposefully organized. The system enforces strict rules, preventing you from spending savings you haven't accumulated yet.

**3. The AI Rescue ⚡**
Instead of just panicking when a shortfall is predicted, the engine automatically triggers our AI integration. The AI instantly drafts a highly professional, math-backed micro-loan request tailored for an underwriting partner, asking for the exact buffer needed to survive the week.

## 🚀 Features
- **Cash Flow Forecasting:** Predictive modeling to visualize runway and upcoming shortfalls.
- **Bucket Budgeting (Envelope System):** 
  - *Spending Buckets:* Set allocated budgets for expenses and track burn rates visually. The progress bar decreases as you spend.
  - *Saving Buckets:* Track progress towards savings goals with strict outflow protections. You cannot withdraw funds you haven't saved.
- **Transaction Management:** Add, move, and categorize transactions on the fly.
- **AI Underwriting Assistant:** Automatically generates bank-ready micro-loan request letters using the Gemini API based on real-time deficit data.

## 🛠️ Tech Stack
- **Frontend:** Vanilla JavaScript, HTML5, Tailwind CSS
- **Backend:** Node.js, Express
- **AI Integration:** Google Gemini API
- **Data:** CSV ledgers (`ledger_stable.csv`, `ledger_crunch.csv`)

## 📦 Running the Application

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

4. **Build for Production:**
   ```bash
   npm run build
   ```
