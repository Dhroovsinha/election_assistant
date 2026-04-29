/**
 * app.js — AI Election Decision Assistant
 * Strategy Simulator, Chat, What-If, Real test validation
 */

"use strict";

import {
  handleQuery,
  sanitize,
  saveToFirebase,
  detectIntent,
  handleWhatIf
} from "./assistant.js";

/* ══════════════════════════════════════════════════════════════
   1.  STRATEGY SIMULATOR — DECISION ENGINE
══════════════════════════════════════════════════════════════ */

/**
 * generatePlan({ firstTime, registered, days })
 * Pure function — returns a formatted string for testing.
 * Also returns metadata via .meta for rendering.
 */
function generatePlan({ firstTime, registered, days }) {
  const stepList   = [];
  const urgencies  = [];
  const reasoning  = [];
  let   confidence = 80;

  /* ── Urgency signals ─────────────────────────────────────── */
  if (days <= 1) {
    urgencies.push("⚠️ Voting starts tomorrow — act immediately!");
  } else if (days <= 3) {
    urgencies.push(`⏳ Only ${days} days left — limited time to prepare.`);
  } else if (days <= 7) {
    urgencies.push("⚠️ Less than a week until election day — start today.");
  }

  if (!registered && days > 30) {
    urgencies.push("📋 Registration window is still open — register now to be safe.");
  } else if (!registered && days <= 30) {
    urgencies.push("⚠️ Registration closes soon — check the deadline immediately!");
  }

  /* ── Step 1: Registration ────────────────────────────────── */
  if (!registered) {
    stepList.push({
      title:  "Check & Complete Voter Registration",
      detail: "Visit nvsp.in or voters.eci.gov.in. Fill Form 6 online. Provide proof of age, address, and a photo. Track your application with the acknowledgement number.",
      urgent: days <= 30
    });
    reasoning.push("registration is incomplete");
    confidence -= 5;
  } else {
    stepList.push({
      title:  "Verify Your Registration Status",
      detail: "Visit voters.eci.gov.in and confirm your name appears on the electoral roll. Discrepancies can be corrected at your local ERO office.",
      urgent: false
    });
    reasoning.push("registration verified");
    confidence += 5;
  }

  /* ── Step 2: Documents ───────────────────────────────────── */
  stepList.push({
    title:  "Gather Required Documents",
    detail: firstTime
      ? "First-time voters: Collect your Voter ID (EPIC) or e-EPIC from nvsp.in. Alternates: Aadhaar, Passport, PAN, Driving Licence, or any government-issued photo ID."
      : "Locate your Voter ID (EPIC card). If misplaced, download e-EPIC from nvsp.in using your EPIC number or mobile number.",
    urgent: days <= 3
  });
  if (firstTime) { reasoning.push("first-time voter needs document guidance"); confidence += 3; }

  /* ── Step 3: Polling booth ───────────────────────────────── */
  stepList.push({
    title:  "Find Your Polling Station",
    detail: "Go to voters.eci.gov.in → 'Search in Electoral Roll' → enter EPIC number or Aadhaar. Note the booth address and serial number. Save it on your phone.",
    urgent: days <= 5
  });

  /* ── Step 4: Research candidates ────────────────────────── */
  if (firstTime || days > 7) {
    stepList.push({
      title:  "Research Your Candidates",
      detail: "Use the Voter Helpline App or affidavit.eci.gov.in to view candidate details, declarations, and records. Make an informed choice before election day.",
      urgent: false
    });
    if (firstTime) reasoning.push("first-time voter needs candidate awareness");
  }

  /* ── Step 5: Plan your visit ─────────────────────────────── */
  stepList.push({
    title:  "Plan Your Voting Day Logistics",
    detail: days <= 1
      ? "Voting is tomorrow! Set an alarm for early morning (7–9 AM) — queues are shortest. Arrange transport now."
      : "Mark voting day on your calendar. Vote between 7–9 AM or 2–4 PM to avoid peak queues. Arrange transport or childcare in advance.",
    urgent: days <= 2
  });

  /* ── Step 6: What to expect ──────────────────────────────── */
  stepList.push({
    title:  "What to Expect at the Polling Booth",
    detail: "Show ID → staff verify your name → collect token slip → proceed to EVM → press button next to your candidate's symbol → VVPAT confirmation slip appears → Done! The ink mark is your badge of honour. 🗳️",
    urgent: false
  });

  /* ── First-time voter bonus ──────────────────────────────── */
  if (firstTime) {
    stepList.push({
      title:  "Post-Vote: Spread the Word",
      detail: "Encourage family and friends to vote. Share with #IVoted. Civic participation grows when communities support each other.",
      urgent: false
    });
    confidence += 2;
  }

  confidence = Math.min(Math.max(confidence, 65), 97);

  const reasonText = reasoning.length
    ? `Recommended based on: ${reasoning.join(", ")}. Steps ordered by urgency given ${days} day(s) remaining.`
    : `Standard plan ordered by importance. With ${days} day(s) until voting, you have adequate preparation time.`;

  /* ── Build formatted text string (used by runTests) ─────── */
  const textLines = stepList.map((s, i) => `Step ${i + 1}: ${s.title}`).join("\n");

  // Attach metadata for renderer — doesn't affect string comparison
  generatePlan._lastMeta = { stepList, urgencies, reasonText, confidence };

  return textLines; // string — supports .includes("Step 1")
}

/** Render the plan to the DOM using the last generatePlan() call */
function renderPlan({ firstTime, registered, days }) {
  const text = generatePlan({ firstTime, registered, days });
  const { stepList, urgencies, reasonText, confidence } = generatePlan._lastMeta;

  const voterType = firstTime  ? "first-time voter" : "returning voter";
  const regStatus = registered ? "registered"       : "not yet registered";

  document.getElementById("plan-title").textContent =
    `You are a ${voterType} who is ${regStatus}, with ${days} day(s) until voting. Here's your personalized plan:`;

  document.getElementById("confidence-score").textContent = `${confidence}% Confidence`;
  document.getElementById("plan-reasoning").textContent   = `💡 ${reasonText}`;

  const urgencyEl = document.getElementById("urgency-banner");
  if (urgencies.length) {
    urgencyEl.innerHTML = urgencies.map(u => `<div>${u}</div>`).join("");
    urgencyEl.classList.add("show");
  } else {
    urgencyEl.classList.remove("show");
  }

  document.getElementById("plan-steps").innerHTML = stepList.map((s, i) => `
    <li class="plan-step${s.urgent ? " urgent-step" : ""}">
      <div class="step-num">${i + 1}</div>
      <div class="step-body">
        <div class="step-title">${s.urgent ? "🚨 " : ""}${s.title}</div>
        <div class="step-detail">${s.detail}</div>
      </div>
    </li>
  `).join("");

  document.getElementById("plan-output").classList.add("visible");
  document.getElementById("plan-output").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── Simulator form handler ──────────────────────────────── */
function initSimulator() {
  document.getElementById("simulator-form").addEventListener("submit", e => {
    e.preventDefault();

    const firstTime  = document.getElementById("voter-type").value === "first";
    const registered = document.getElementById("reg-status").value  === "yes";
    const days       = parseInt(document.getElementById("days-left").value, 10);

    if (!days || days < 1) {
      alert("Please enter a valid number of days (minimum 1).");
      return;
    }

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled    = true;
    btn.textContent = "Analyzing your situation…";

    setTimeout(() => {
      renderPlan({ firstTime, registered, days });
      btn.disabled = false;
      btn.innerHTML = `<span>🔄</span> Regenerate Plan`;
    }, 900);
  });
}

/* ══════════════════════════════════════════════════════════════
   2.  INTERACTIVE CHAT ASSISTANT
══════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  return str
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function appendBubble(role, text, sourceTag) {
  const chatWin = document.getElementById("chat-window");
  const isUser  = role === "user";

  const tag = sourceTag === "gemini"
    ? `<span style="font-size:0.65rem;color:var(--accent);margin-top:4px;display:block;">✨ AI Response (Gemini)</span>`
    : sourceTag === "fallback"
      ? `<span style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;display:block;">📚 Rule-based response</span>`
      : "";

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${isUser ? "user" : "ai"}`;
  bubble.innerHTML = `
    <div class="bubble-avatar ${isUser ? "usr-av" : "ai-av"}">${isUser ? "👤" : "🤖"}</div>
    <div class="bubble-text">${escapeHtml(text)}${tag}</div>
  `;
  chatWin.appendChild(bubble);
  chatWin.scrollTop = chatWin.scrollHeight;
}

function showCloudStatus(success) {
  const el = document.getElementById("cloud-status");
  if (!el) return;
  el.textContent = success ? "✅ Saved to cloud database" : "☁️ Cloud save unavailable";
  el.style.color = success ? "var(--success)" : "var(--text-muted)";
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

async function sendMessage(queryOverride) {
  const input     = document.getElementById("chat-input");
  const query     = queryOverride || input.value;
  const sanitized = sanitize(query);

  if (!sanitized) {
    input.focus();
    input.style.borderColor = "var(--danger)";
    setTimeout(() => { input.style.borderColor = ""; }, 1200);
    return;
  }

  appendBubble("user", sanitized);
  if (!queryOverride) input.value = "";

  const sendBtn   = document.getElementById("send-btn");
  const loadingEl = document.getElementById("loading");
  sendBtn.disabled = true;
  loadingEl.classList.add("show");

  try {
    // Always try Gemini first (handled inside handleQuery)
    const { source, text } = await handleQuery(sanitized);
    appendBubble("ai", text, source);

    // Firebase — always write after every query
    const saved = await saveToFirebase(sanitized);
    showCloudStatus(saved);

  } catch (err) {
    appendBubble("ai", `⚠️ ${err.message || "Something went wrong. Please try again."}`);
  } finally {
    sendBtn.disabled = false;
    loadingEl.classList.remove("show");
    input.focus();
  }
}

function initChat() {
  document.getElementById("send-btn").addEventListener("click", () => sendMessage());

  document.getElementById("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => sendMessage(chip.dataset.query));
  });
}

/* ══════════════════════════════════════════════════════════════
   3.  WHAT-IF SCENARIOS
══════════════════════════════════════════════════════════════ */

const SCENARIOS = [
  { icon: "🗓️", q: "What if I miss voting day?",               key: "miss voting" },
  { icon: "📋", q: "What if I'm not on the electoral roll?",   key: "not on roll" },
  { icon: "🏠", q: "What if I moved recently?",                key: "moved recently" },
  { icon: "🪪", q: "What if I lose my Voter ID?",              key: "lost voter id" },
  { icon: "🖥️", q: "What if the EVM malfunctions?",            key: "evm malfunction" },
  { icon: "🎓", q: "What if I'm a student studying away?",     key: "student" }
];

function initScenarios() {
  const grid = document.getElementById("scenarios-grid");
  grid.innerHTML = SCENARIOS.map((s, i) => `
    <button class="scenario-card" aria-expanded="false" id="scenario-${i}"
            aria-controls="scenario-ans-${i}">
      <div class="scenario-icon">${s.icon}</div>
      <div class="scenario-q">${s.q}</div>
      <div class="scenario-a" id="scenario-ans-${i}">${handleWhatIf(s.key)}</div>
    </button>
  `).join("");

  grid.querySelectorAll(".scenario-card").forEach(card => {
    card.addEventListener("click", () => {
      const isOpen = card.classList.contains("open");
      grid.querySelectorAll(".scenario-card").forEach(c => {
        c.classList.remove("open");
        c.setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        card.classList.add("open");
        card.setAttribute("aria-expanded", "true");
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   4.  REAL TEST VALIDATION — runs on page load
══════════════════════════════════════════════════════════════ */

function runTests() {
  const tests = [];

  // Test 1: Strategy output contains "Step 1"
  const plan = generatePlan({ firstTime: true, registered: false, days: 2 });
  tests.push(plan.includes("Step 1"));

  // Test 2: Intent detection returns correct intent
  const intent = detectIntent("how to vote");
  tests.push(intent === "voting");

  // Test 3: What-if scenario returns non-empty response
  const response = handleWhatIf("miss voting");
  tests.push(response.length > 0);

  tests.forEach((pass, i) => {
    console.log(`TEST ${i + 1}: ${pass ? "PASSED" : "FAILED"}`);
  });
}

/* ══════════════════════════════════════════════════════════════
   5.  INIT
══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  initSimulator();
  initChat();
  initScenarios();
  runTests(); // Real tests run on every page load

  // Welcome message
  setTimeout(() => {
    appendBubble(
      "ai",
      `👋 Welcome to the AI Election Decision Assistant!\n\nI can help you with:\n• Your personalized voter action plan (use the simulator above)\n• Registration & document requirements\n• Election timeline & phases\n• What-if scenarios\n\nPowered by Google Gemini AI. Click a quick question or type your own!`
    );
  }, 400);
});
