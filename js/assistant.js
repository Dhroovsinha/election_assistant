/**
 * assistant.js — AI Election Decision Assistant
 * Gemini API (always attempted first) + Firebase + Rule-based fallback
 */

"use strict";

/* ══════════════════════════════════════════════════════════════
   CONFIGURATION — replace with real keys before deployment
══════════════════════════════════════════════════════════════ */
const GEMINI_API_KEY   = "AIzaSyAgy4A7TNNjW4YsWEPa0juzK9dFRZdmdoo";
const FIREBASE_CONFIG  = {
  apiKey:            "AIzaSyC83Fonl80gB8iTIWw5KU7PO8_CgeG3Xc0",
  authDomain:        "election-assistant-42bfd.firebaseapp.com",
  databaseURL:       "https://election-assistant-42bfd-default-rtdb.firebaseio.com",
  projectId:         "election-assistant-42bfd",
  storageBucket:     "election-assistant-42bfd.firebasestorage.app",
  messagingSenderId: "253613716156",
  appId:             "1:253613716156:web:5cd1e3348d837b16cb56b9"
};

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_CONTEXT =
  `You are the AI Election Decision Assistant — a concise, helpful expert on election
processes, voter registration, voting rights, and civic participation. Provide step-by-step
guidance where appropriate. Keep responses under 200 words. Format lists with numbered steps.`;

/* ══════════════════════════════════════════════════════════════
   FIREBASE — init and write helper
══════════════════════════════════════════════════════════════ */
import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push }    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let _db = null;
try {
  const app = initializeApp(FIREBASE_CONFIG);
  _db = getDatabase(app);
} catch (e) {
  console.warn("Firebase init failed:", e.message);
}

/**
 * Save a query to Firebase Realtime Database.
 * Returns true on success, false on failure.
 */
export async function saveToFirebase(text) {
  if (!_db) {
    console.warn("Firebase not configured — skipping write.");
    return false;
  }
  try {
    await push(ref(_db, "queries"), { text, time: Date.now() });
    console.log("Firebase write successful");
    return true;
  } catch (e) {
    console.warn("Firebase write failed:", e.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
   GEMINI API — always attempted first
══════════════════════════════════════════════════════════════ */
export async function callGemini(userMessage) {
  console.log("Gemini API called");

  const res = await fetch(GEMINI_ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_CONTEXT}\n\nUser query: ${userMessage}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "No response received.";
}

/* ══════════════════════════════════════════════════════════════
   INTENT DETECTION — exported for testing
══════════════════════════════════════════════════════════════ */
const INTENT_MAP = [
  { intent: "voting",        patterns: ["how to vote", "how do i vote", "voting process", "cast my vote"] },
  { intent: "registration",  patterns: ["register", "registration", "form 6", "sign up to vote", "how to register"] },
  { intent: "documents",     patterns: ["document", "what to bring", "what to carry", "what do i bring"] },
  { intent: "timeline",      patterns: ["timeline", "election phases", "election schedule", "when is"] },
  { intent: "whatif",        patterns: ["miss voting", "miss election", "what if i miss", "can't vote", "cannot vote", "absent"] },
  { intent: "booth",         patterns: ["polling booth", "where to vote", "polling station", "location"] },
  { intent: "firsttime",     patterns: ["first time", "first-time voter", "new voter", "beginner"] },
  { intent: "plan",          patterns: ["personal plan", "my plan", "what should i do", "help me"] }
];

export function detectIntent(query) {
  const q = query.toLowerCase().trim();
  for (const { intent, patterns } of INTENT_MAP) {
    if (patterns.some(p => q.includes(p))) return intent;
  }
  return "general";
}

/* ══════════════════════════════════════════════════════════════
   WHAT-IF HANDLER — exported for testing
══════════════════════════════════════════════════════════════ */
const WHATIF_MAP = [
  {
    keys: ["miss voting", "miss election", "miss voting day"],
    answer: "Unfortunately, votes cannot be cast after polling closes. If you knew in advance you'd be unavailable, you may apply for a postal ballot before election day. For the future: register early, set calendar reminders, and check postal ballot eligibility if travel is a concern."
  },
  {
    keys: ["not on roll", "not on electoral roll"],
    answer: "Visit your nearest Electoral Registration Officer (ERO) or Booth Level Officer (BLO) with proof of residence. File a complaint on the NVSP portal or call the Election Commission helpline 1950."
  },
  {
    keys: ["moved recently", "moved", "new address"],
    answer: "Update your address using Form 8A on nvsp.in before the revision deadline. If not done in time, you can still vote at your old constituency's booth until the change is officially processed."
  },
  {
    keys: ["lost voter id", "lost my voter", "no voter id"],
    answer: "Download your e-EPIC instantly from nvsp.in using your EPIC number or registered mobile. Accepted alternates: Aadhaar, Passport, PAN, or any government-issued photo ID."
  },
  {
    keys: ["evm malfunction", "evm broke", "machine not working"],
    answer: "Inform the Presiding Officer immediately. EVMs are replaced if they malfunction; your vote is not lost. File a complaint via 1950 or eci.gov.in."
  },
  {
    keys: ["student", "studying away", "away from home"],
    answer: "Option 1: Register at your current address via Form 6 on nvsp.in (if staying 6+ months). Option 2: Travel home to vote. Postal ballot may apply for some election types — check nvsp.in."
  }
];

export function handleWhatIf(query) {
  const q = query.toLowerCase().trim();
  for (const { keys, answer } of WHATIF_MAP) {
    if (keys.some(k => q.includes(k))) return answer;
  }
  // Always returns a non-empty string
  return "For this what-if situation, please contact the Election Commission helpline at 1950 or visit eci.gov.in for official guidance tailored to your specific circumstances.";
}

/* ══════════════════════════════════════════════════════════════
   RULE-BASED FALLBACK
══════════════════════════════════════════════════════════════ */
const RULE_RESPONSES = {
  voting:
`**How to Vote — Step-by-Step**

1. Verify your registration at voters.eci.gov.in
2. Find your assigned polling booth (EPIC card or NVSP portal)
3. Bring your Voter ID (or approved alternate: Aadhaar, Passport, PAN)
4. Arrive between 7–9 AM or 2–4 PM to avoid peak queues
5. Show ID → get inked → press EVM button → VVPAT confirmation slip → Done ✅`,

  registration:
`**Voter Registration Guide**

1. Visit nvsp.in or voters.eci.gov.in
2. Fill Form 6 (new registration) online or offline
3. Provide proof of age, proof of address, and a passport photo
4. Submit — you'll receive an acknowledgement number
5. Download or collect Voter ID once approved
⚠️ Registration typically closes 4–6 weeks before election day.`,

  documents:
`**Documents to Bring**

Primary: Voter ID (EPIC card)
Alternates accepted:
• Aadhaar Card  • Passport  • Driving Licence
• PAN Card  • Government-issued photo ID
• MNREGA job card  • Bank passbook with photo`,

  timeline:
`**Election Timeline & Phases**

📋 Phase 1 — Voter Registration (closes ~6 weeks before)
📢 Phase 2 — Campaigning (21–30 days)
🔇 Phase 3 — Silent Period (48 hrs before voting)
🗳️ Phase 4 — Voting Day (7 AM – 6 PM)
📊 Phase 5 — Counting & Results
🏛️ Phase 6 — Government Formation`,

  whatif:
`Use the **What-If Scenarios** section below, or ask specifically (e.g., "What if I miss voting day?")`,

  booth:
`**Finding Your Polling Booth**

1. Visit voters.eci.gov.in
2. Search by EPIC number or Aadhaar
3. Your polling station address and serial number will be shown
4. Or call 1950 (Election Commission helpline)`,

  firsttime:
`**First-Time Voter Guide** 🎉

1. Register at nvsp.in → Fill Form 6
2. Get your Voter ID (download e-EPIC from nvsp.in)
3. Find your booth at voters.eci.gov.in
4. Research candidates at affidavit.eci.gov.in
5. On election day: bring ID, join queue, press EVM button 🗳️
Your first vote is a milestone — make it count! 🇮🇳`,

  plan:
`Use the **Election Strategy Simulator** above to generate your personalized action plan! Fill in your voter type, registration status, and days remaining.`,

  general:
`I can help with:
• 📝 Voter registration
• 🗳️ How to vote (step-by-step)
• 📄 Required documents
• 📅 Election timeline & phases
• 🏫 Finding your polling booth
• ❓ What-if scenarios

Or use the **Election Strategy Simulator** above for a personalized plan!`
};

export function fallbackResponse(query) {
  const intent = detectIntent(query);
  return RULE_RESPONSES[intent] || RULE_RESPONSES.general;
}

/* ══════════════════════════════════════════════════════════════
   UNIFIED QUERY HANDLER — Gemini always first
══════════════════════════════════════════════════════════════ */
export async function handleQuery(query) {
  const sanitized = sanitize(query);
  if (!sanitized) throw new Error("Please enter a valid question.");

  // Always attempt Gemini first
  try {
    const text = await callGemini(sanitized);
    return { source: "gemini", text: `AI Response (Gemini): ${text}` };
  } catch (e) {
    console.log("Gemini failed → fallback");
    return { source: "fallback", text: fallbackResponse(sanitized) };
  }
}

/* ══════════════════════════════════════════════════════════════
   INPUT SANITIZATION
══════════════════════════════════════════════════════════════ */
export function sanitize(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[^\w\s?.,'"\-!@#$%&*()\[\]]/g, "")
    .slice(0, 500);
}
