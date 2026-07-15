/**
 * QuantumCash secure bank-style web interface logic.
 * Handled features: Session management, OTP generation & verification, reCAPTCHA mockup, and dashboard account switching.
 */

// Dummy Account Data
const ACCOUNTS_DATA = {
  primary: {
    name: "Primary Operating Account",
    number: "•••• •••• •••• 4920",
    balance: 456.20,
    type: "Checking",
    transactions: [
      { date: "2026-07-14", desc: "Daily Sales Inflow", amount: 242.45, type: "inflow" },
      { date: "2026-07-13", desc: "Daily Overhead", amount: -85.80, type: "outflow" },
      { date: "2026-07-12", desc: "Daily Sales Inflow", amount: 242.45, type: "inflow" },
      { date: "2026-07-10", desc: "Supplier Payment", amount: -1200.00, type: "outflow" }
    ]
  },
  tax: {
    name: "Tax Reserve Account",
    number: "•••• •••• •••• 8831",
    balance: 4200.00,
    type: "Savings",
    transactions: [
      { date: "2026-07-01", desc: "Monthly Allocation Transfer", amount: 1000.00, type: "inflow" },
      { date: "2026-06-15", desc: "Quarterly Est. Tax Payment", amount: -2500.00, type: "outflow" }
    ]
  },
  payroll: {
    name: "Payroll Funding Account",
    number: "•••• •••• •••• 1045",
    balance: 8500.00,
    type: "Checking",
    transactions: [
      { date: "2026-07-10", desc: "Transfer from Primary", amount: 5000.00, type: "inflow" },
      { date: "2026-07-03", desc: "Bi-weekly Employees Payroll", amount: -2500.00, type: "outflow" },
      { date: "2026-06-19", desc: "Bi-weekly Employees Payroll", amount: -2500.00, type: "outflow" }
    ]
  }
};

// Application State
let appState = {
  currentUser: null,
  activeAccountKey: "primary",
  generatedOTP: null,
  captchaVerified: false,
  otpVerified: false
};

// Utility: Save and Load sessions persistently
function saveSession() {
  localStorage.setItem("quantum_session", JSON.stringify({
    currentUser: appState.currentUser,
    activeAccountKey: appState.activeAccountKey
  }));
}

function loadSession() {
  const session = localStorage.getItem("quantum_session");
  if (session) {
    const data = JSON.parse(session);
    appState.currentUser = data.currentUser;
    appState.activeAccountKey = data.activeAccountKey || "primary";
    return true;
  }
  return false;
}

function clearSession() {
  localStorage.removeItem("quantum_session");
  appState.currentUser = null;
  appState.activeAccountKey = "primary";
  appState.generatedOTP = null;
  appState.captchaVerified = false;
  appState.otpVerified = false;
}

// UI State Switcher
function showScreen(screenId) {
  // Hide all screens
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("otp-screen").classList.add("hidden");
  document.getElementById("dashboard-screen").classList.add("hidden");
  
  // Show target screen
  document.getElementById(screenId).classList.remove("hidden");
  
  // Custom screen actions
  if (screenId === "dashboard-screen") {
    renderDashboard();
  }
}

// Custom Alert Helpers
function showAuthError(msg) {
  const container = document.getElementById("auth-error-msg");
  const text = document.getElementById("auth-error-text");
  if (msg) {
    text.textContent = msg;
    container.classList.remove("hidden");
  } else {
    container.classList.add("hidden");
  }
}

function showOtpError(msg) {
  const container = document.getElementById("otp-error-msg");
  const text = document.getElementById("otp-error-text");
  if (msg) {
    text.textContent = msg;
    container.classList.remove("hidden");
  } else {
    container.classList.add("hidden");
  }
}

// Generate a random 6-digit OTP
function generateOTP() {
  appState.generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  // Display OTP in the secure notification simulator
  const simulator = document.getElementById("otp-simulator");
  const simulatorCode = document.getElementById("simulator-code");
  simulatorCode.textContent = appState.generatedOTP;
  simulator.classList.remove("hidden");
  
  // Auto-hide simulator after 60 seconds
  setTimeout(() => {
    if (appState.generatedOTP) {
      simulator.classList.add("hidden");
    }
  }, 60000);
}

// Render Dashboard Data
function renderDashboard() {
  const account = ACCOUNTS_DATA[appState.activeAccountKey];
  if (!account) return;

  // Set Profile and Account Details
  document.getElementById("user-display-name").textContent = appState.currentUser.name || "Valued Customer";
  document.getElementById("account-title").textContent = account.name;
  document.getElementById("account-number").textContent = account.number;
  document.getElementById("account-type-badge").textContent = account.type;
  
  // Balance Formatting
  const balanceStr = account.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById("account-balance").textContent = `$${balanceStr}`;

  // Populate Dropdown Checkmark
  const keys = ["primary", "tax", "payroll"];
  keys.forEach(k => {
    const checkmark = document.getElementById(`check-${k}`);
    if (checkmark) {
      if (k === appState.activeAccountKey) {
        checkmark.classList.remove("hidden");
      } else {
        checkmark.classList.add("hidden");
      }
    }
  });

  // Populate Transactions
  const txnList = document.getElementById("transaction-list");
  txnList.innerHTML = "";
  
  if (account.transactions.length === 0) {
    txnList.innerHTML = `<div class="p-6 text-center text-slate-400">No recent transactions.</div>`;
    return;
  }

  account.transactions.forEach(txn => {
    const isNegative = txn.amount < 0;
    const amountFormatted = Math.abs(txn.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const colorClass = isNegative ? "text-rose-400" : "text-emerald-400";
    const prefix = isNegative ? "-" : "+";

    const txnRow = document.createElement("div");
    txnRow.className = "flex items-center justify-between p-4 border-b border-slate-800 hover:bg-slate-800/40 transition duration-150";
    txnRow.innerHTML = `
      <div>
        <p class="font-medium text-slate-200 text-sm md:text-base">${txn.desc}</p>
        <p class="text-xs text-slate-400">${txn.date}</p>
      </div>
      <div class="text-right">
        <p class="font-semibold text-sm md:text-base ${colorClass}">${prefix}$${amountFormatted}</p>
      </div>
    `;
    txnList.appendChild(txnRow);
  });
}

// Initializing Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Form Auth Switching (Login vs Register)
  const toggleAuthLink = document.getElementById("toggle-auth-link");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  const nameFieldGroup = document.getElementById("name-field-group");
  const submitButtonText = document.getElementById("submit-button-text");
  
  let isRegisterMode = false;

  toggleAuthLink.addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    
    showAuthError(null); // Clear errors
    
    // Reset state & inputs
    document.getElementById("auth-form").reset();
    appState.captchaVerified = false;
    document.getElementById("captcha-checkbox").checked = false;
    document.getElementById("captcha-status").textContent = "Please verify you are human";
    document.getElementById("captcha-status").className = "text-xs text-slate-400";

    if (isRegisterMode) {
      authTitle.textContent = "Create Banking Identity";
      authSubtitle.textContent = "Register a new secure digital wallet for QuantumCash";
      nameFieldGroup.classList.remove("hidden");
      submitButtonText.textContent = "Generate OTP and Register";
      toggleAuthLink.textContent = "Already have an account? Sign In";
    } else {
      authTitle.textContent = "Secure Vault Access";
      authSubtitle.textContent = "Enter your credentials to access your treasury";
      nameFieldGroup.classList.add("hidden");
      submitButtonText.textContent = "Generate OTP and Sign In";
      toggleAuthLink.textContent = "New to QuantumCash? Register Account";
    }
  });

  // Mock reCAPTCHA verification
  const captchaCheckbox = document.getElementById("captcha-checkbox");
  const captchaStatus = document.getElementById("captcha-status");

  captchaCheckbox.addEventListener("change", () => {
    if (captchaCheckbox.checked) {
      captchaStatus.textContent = "reCAPTCHA Verified Successfully";
      captchaStatus.className = "text-xs text-emerald-400 font-medium";
      appState.captchaVerified = true;
    } else {
      captchaStatus.textContent = "Please verify you are human";
      captchaStatus.className = "text-xs text-slate-400";
      appState.captchaVerified = false;
    }
  });

  // Handle Login / Registration Form Submission
  const authForm = document.getElementById("auth-form");
  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showAuthError(null);
    
    if (!appState.captchaVerified) {
      showAuthError("Please complete the reCAPTCHA security verification.");
      return;
    }

    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const name = isRegisterMode ? document.getElementById("name").value : null;

    if (isRegisterMode) {
      // Sign Up: Create user and save locally
      if (!name || !email || !phone) {
        showAuthError("Please fill in all details.");
        return;
      }
      
      const user = { name, email, phone };
      localStorage.setItem(`user_${email}`, JSON.stringify(user));
      appState.currentUser = user;
    } else {
      // Sign In: Find user
      if (!email || !phone) {
        showAuthError("Please fill in your Email and Phone Number.");
        return;
      }

      const storedUser = localStorage.getItem(`user_${email}`);
      if (!storedUser) {
        showAuthError("Account not found. Please register first.");
        return;
      }

      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.phone !== phone) {
        showAuthError("Verification failed. The phone number does not match our records.");
        return;
      }

      appState.currentUser = parsedUser;
    }

    // Trigger OTP generation and transition screen
    generateOTP();
    showScreen("otp-screen");
  });

  // OTP Verification Submission
  const otpForm = document.getElementById("otp-form");
  otpForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showOtpError(null);
    const otpInput = document.getElementById("otp-code").value;

    if (otpInput === appState.generatedOTP) {
      // Success! Clear simulator and set state
      appState.generatedOTP = null;
      document.getElementById("otp-simulator").classList.add("hidden");
      appState.otpVerified = true;
      
      saveSession();
      showScreen("dashboard-screen");
    } else {
      showOtpError("Invalid OTP code. Please check the simulator banner and try again.");
    }
  });

  // Resend OTP Action
  const resendBtn = document.getElementById("resend-otp-btn");
  resendBtn.addEventListener("click", () => {
    generateOTP();
    const simulatorCode = document.getElementById("simulator-code");
    // Add visual feedback
    simulatorCode.classList.add("text-emerald-400");
    setTimeout(() => simulatorCode.classList.remove("text-emerald-400"), 1000);
  });

  // OTP Screen Cancel / Back Action
  const cancelOtpBtn = document.getElementById("cancel-otp-btn");
  cancelOtpBtn.addEventListener("click", () => {
    appState.generatedOTP = null;
    document.getElementById("otp-simulator").classList.add("hidden");
    showScreen("auth-screen");
  });

  // Switch Account Event Handlers
  const accountsMenuBtn = document.getElementById("accounts-menu-button");
  const accountsDropdown = document.getElementById("accounts-dropdown");

  // Toggle Dropdown Menu visibility
  accountsMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    accountsDropdown.classList.toggle("hidden");
  });

  // Close dropdown on click outside
  document.addEventListener("click", () => {
    accountsDropdown.classList.add("hidden");
  });

  // Dropdown Item Switch Handlers
  const keys = ["primary", "tax", "payroll"];
  keys.forEach(k => {
    const btn = document.getElementById(`switch-${k}`);
    if (btn) {
      btn.addEventListener("click", () => {
        appState.activeAccountKey = k;
        saveSession();
        renderDashboard();
        accountsDropdown.classList.add("hidden");
      });
    }
  });

  // Sign Out Handler
  const signOutBtn = document.getElementById("sign-out-btn");
  signOutBtn.addEventListener("click", () => {
    clearSession();
    showScreen("auth-screen");
  });

  // App Init Session Check
  const hasSession = loadSession();
  if (hasSession && appState.currentUser) {
    showScreen("dashboard-screen");
  } else {
    showScreen("auth-screen");
  }

  // Forecast API Integration
  const runForecastBtn = document.getElementById("run-forecast-btn");
  const forecastSection = document.getElementById("forecast-section");
  const forecastContent = document.getElementById("forecast-content");
  
  let currentLoanLetter = "";

  runForecastBtn.addEventListener("click", async () => {
    forecastSection.style.display = "flex";
    forecastContent.innerHTML = `<div class="text-center text-slate-400 py-8">Fetching forecast data...</div>`;
    
    try {
      const response = await fetch('/api/forecast');
      if (!response.ok) {
        let errMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errMsg = errorData.error;
        } catch(e) {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      currentLoanLetter = data.loanLetter;
      
      let patternsHtml = data.patterns.map(p => `<li><span class="font-bold text-slate-200">▪ ${p.name}:</span> ${p.desc}</li>`).join("");
      
      let rowsHtml = data.projection.map(r => `
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/30">
          <td class="py-2 px-3">${r.day}</td>
          <td class="py-2 px-3">${r.date}</td>
          <td class="py-2 px-3 font-medium ${r.start < 0 ? 'text-rose-400' : 'text-slate-200'}">${r.start < 0 ? '-' : ''}$${Math.abs(r.start).toFixed(2)}</td>
          <td class="py-2 px-3 text-emerald-400">$${r.in.toFixed(2)}</td>
          <td class="py-2 px-3 text-slate-300">$${r.out.toFixed(2)}</td>
          <td class="py-2 px-3 font-bold ${r.end < 0 ? 'text-rose-400' : 'text-slate-200'}">${r.end < 0 ? '-' : ''}$${Math.abs(r.end).toFixed(2)}</td>
          <td class="py-2 px-3 ${r.events !== 'None' ? 'font-semibold text-slate-200' : ''}">${r.events}</td>
        </tr>
      `).join("");

      forecastContent.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <p class="text-xs text-slate-400">Analysis Date: <span class="text-slate-200 font-medium">${data.analysisDate}</span></p>
            <p class="text-xs text-slate-400">Current Balance: <span class="text-slate-200 font-medium">$${data.currentBalance.toFixed(2)}</span></p>
          </div>
        </div>
        <div class="mb-6">
          <h4 class="text-blue-400 text-sm font-semibold mb-2">Detected Recurring Cash Flow Patterns</h4>
          <ul class="text-xs text-slate-300 space-y-1">
            ${patternsHtml}
          </ul>
        </div>
        <div class="mb-6 overflow-x-auto">
          <table class="w-full text-left text-xs text-slate-300 whitespace-nowrap">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400">
                <th class="py-2 px-3 font-semibold">Day</th>
                <th class="py-2 px-3 font-semibold">Date</th>
                <th class="py-2 px-3 font-semibold">Starting Bal</th>
                <th class="py-2 px-3 font-semibold">Inflows</th>
                <th class="py-2 px-3 font-semibold">Outflows</th>
                <th class="py-2 px-3 font-semibold">Ending Bal</th>
                <th class="py-2 px-3 font-semibold">Scheduled Events</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        <div class="bg-rose-950/30 border-l-4 border-rose-500 p-4 rounded-r-lg">
          <h4 class="text-rose-400 font-bold mb-1 uppercase tracking-wider">Critical Warning: Cash Crunch Detected</h4>
          <p class="text-sm text-slate-200">Predicted Balance will DIP BELOW ZERO on: <span class="font-bold">${data.warning.date}</span></p>
          <p class="text-sm text-slate-200">Estimated Shortfall: <span class="font-bold text-rose-400">$${data.warning.shortfall.toFixed(2)}</span></p>
          <p class="text-xs text-slate-400 italic mt-2">Please arrange for line of credit or delay outgoing payments immediately.</p>
          <button id="generate-loan-btn" class="mt-4 text-xs bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-lg shadow-rose-600/20">Generate Loan Request Letter</button>
        </div>
      `;

      // Attach event listener to new button
      document.getElementById("generate-loan-btn").addEventListener("click", () => {
        document.getElementById("loan-letter-content").textContent = currentLoanLetter;
        document.getElementById("loan-modal").classList.remove("hidden");
      });

    } catch (err) {
      console.error(err);
      forecastContent.innerHTML = `<div class="text-center text-rose-400 py-8">Failed to fetch forecast data: ${err.message}</div>`;
    }
  });

  // Loan Modal Handlers
  document.getElementById("close-loan-modal").addEventListener("click", () => {
    document.getElementById("loan-modal").classList.add("hidden");
  });

  document.getElementById("copy-loan-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(currentLoanLetter).then(() => {
      alert("Letter copied to clipboard!");
    });
  });

  document.getElementById("send-loan-btn").addEventListener("click", () => {
    alert("Request sent successfully to [Bank Name].");
    document.getElementById("loan-modal").classList.add("hidden");
  });

  // Chatbot Logic
  const chatToggleBtn = document.getElementById('chat-toggle-btn');
  const chatWindow = document.getElementById('chat-window');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');

  let chatHistory = [];

  function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end self-end' : 'items-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `p-3 text-sm ${isUser ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm'}`;
    bubble.textContent = text;
    
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.id = 'typing-indicator';
    msgDiv.className = `flex flex-col items-start gap-1 max-w-[85%]`;
    
    const bubble = document.createElement('div');
    bubble.className = `p-3 text-sm bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm flex items-center gap-1`;
    bubble.innerHTML = `<span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>`;
    
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  chatToggleBtn.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
  });

  closeChatBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message to UI
    addMessage(message, true);
    chatInput.value = '';
    
    // Add to history
    chatHistory.push({ role: "user", parts: [{ text: message }] });

    // Show typing
    addTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: chatHistory })
      });

      removeTypingIndicator();

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();
      const reply = data.reply || "I'm sorry, I couldn't process that request.";
      
      addMessage(reply, false);
      chatHistory.push({ role: "model", parts: [{ text: reply }] });

    } catch (error) {
      removeTypingIndicator();
      console.error('Chat error:', error);
      addMessage('Sorry, there was an error communicating with the server.', false);
    }
  });

});
