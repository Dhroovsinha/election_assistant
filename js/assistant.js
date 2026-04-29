/**
 * assistant.js — AI Election Decision Assistant
 * Handles Gemini API integration with rule-based fallback
 */

"use strict";

/* ── Gemini API config ─────────────────────────────────────── */
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Users paste their API key in the UI; we never hard-code credentials.
let _apiKey = "";

export function setApiKey(key) {
  _apiKey = (key || "").trim();
}

export function hasApiKey() {
  return _apiKey.length > 0;
}

/* ── System prompt for Gemini ──────────────────────────────── */
const SYSTEM_CONTEXT = `You are the AI Election Decision Assistant — a helpful, concise expert 
on election processes, voter registration, voting rights, and civic participation. 
Provide step-by-step guidance where appropriate. Keep responses under 200 words. 
Format lists with numbered steps when explaining processes. Be encouraging and accessible.`;

/* ── Call Gemini API ───────────────────────────────────────── */
export async function callGemini(userMessage) {
  console.log("Gemini API called"); // Required console signal

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_CONTEXT}\n\nUser query: ${userMessage}` }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512
    }
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${_apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
  return text.trim();
}

/* ── Rule-based fallback responses ────────────────────────── */
const RULES = [
  {
    patterns: ["how to vote", "how do i vote", "voting process", "cast my vote"],
    response: `**How to Vote — Step-by-Step**

1. **Verify your registration** — Check your name on the electoral roll at your state's election website.
2. **Find your polling booth** — Use your voter ID card or the official website to locate your assigned booth.
3. **Gather documents** — Bring your Voter ID card (or approved alternate ID such as Aadhaar, Passport, PAN card).
4. **Go on voting day** — Arrive during polling hours (usually 7 AM – 6 PM). Queues are shorter mid-morning.
5. **Cast your vote** — Show ID → get inked → press the EVM button → receive VVPAT confirmation slip.
6. **Done!** — You've exercised your democratic right. ✅`
  },
  {
    patterns: ["register", "registration", "how to register", "sign up to vote"],
    response: `**Voter Registration Guide**

1. Visit your state's Chief Electoral Officer (CEO) website or the NVSP portal (nvsp.in).
2. Fill Form 6 (new voter registration) online or offline.
3. Provide proof of age (birth certificate, class 10 marksheet), proof of address, and a passport photo.
4. Submit the form — you'll receive an acknowledgement number.
5. Track your application status on the NVSP portal.
6. Download or collect your Voter ID card once approved.

⚠️ Registration deadlines are typically 4–6 weeks before election day.`
  },
  {
    patterns: ["document", "id", "what do i bring", "what to bring", "what to carry"],
    response: `**Documents to Bring for Voting**

Your Voter ID (EPIC card) is the primary document. If unavailable, these are accepted alternatives:
- Aadhaar Card
- Passport
- Driving Licence
- PAN Card
- Government-issued photo ID
- MNREGA job card
- Bank / Post Office passbook with photo

Tip: Check the Election Commission of India's latest approved list before voting day.`
  },
  {
    patterns: ["timeline", "election phases", "election schedule", "when is"],
    response: `**Election Timeline & Phases**

📋 **Phase 1 — Voter Registration** (closes ~6 weeks before election)
📢 **Phase 2 — Campaign Period** (official campaign window, typically 21–30 days)
🗳️ **Phase 3 — Voting Day** (polls open 7 AM – 6 PM)
🔇 **Phase 4 — Silent Period** (48 hours before voting, no campaigning)
📊 **Phase 5 — Counting & Results** (usually 2–5 days after voting)
🏛️ **Phase 6 — Government Formation** (following results)

The Election Commission of India announces all official dates via press release and its website (eci.gov.in).`
  },
  {
    patterns: ["miss voting", "miss election", "can't vote", "cannot vote", "what if i miss", "absent"],
    response: `**What if You Miss Voting Day?**

Unfortunately, once voting day has passed, your vote cannot be cast retroactively. However:

- **Postal ballot**: If you're away (e.g., on duty, abroad), you may be eligible for a postal ballot. Apply in advance with the Returning Officer.
- **Plan ahead**: Mark voting day in your calendar, arrange travel/work schedules accordingly.
- **Your vote matters**: Even a single vote can decide local races — every vote counts.

For the next election: register early, set reminders, and check for postal ballot eligibility if travel is a concern.`
  },
  {
    patterns: ["polling booth", "where to vote", "location", "polling station"],
    response: `**Finding Your Polling Booth**

1. Visit **voters.eci.gov.in** or your state CEO website.
2. Enter your name, EPIC number, or Aadhaar (if seeded).
3. Your assigned polling station address and serial number will be shown.
4. You can also check the Voter Helpline App or call **1950** (Election Commission helpline).

Always confirm your booth at least a week before election day to avoid surprises.`
  },
  {
    patterns: ["first time", "first-time voter", "new voter", "beginner"],
    response: `**First-Time Voter Guide** 🎉

Welcome to democracy! Here's what you need to know:

1. **Register first** — If not already registered, visit nvsp.in and fill Form 6.
2. **Get your Voter ID** — It arrives by post or can be downloaded as an e-EPIC.
3. **Find your booth** — Use voters.eci.gov.in to locate your polling station.
4. **Know your candidates** — Research candidates using the Voter Helpline App or Affidavit portal.
5. **On election day** — Bring your ID, join the queue, follow booth staff instructions.
6. **Cast your vote** — Press the EVM button next to your chosen candidate's symbol.

Your first vote is a milestone — make it count! 🇮🇳`
  },
  {
    patterns: ["evm", "electronic voting", "voting machine", "how does evm work"],
    response: `**How Electronic Voting Machines (EVMs) Work**

1. The Presiding Officer enables the Control Unit before each voter.
2. You press the blue button next to your candidate's name/symbol on the Ballot Unit.
3. A beep confirms your vote is recorded.
4. The VVPAT machine prints a paper slip showing your candidate's name and symbol — visible for 7 seconds through a glass window.
5. The slip automatically drops into a sealed box for audit purposes.

EVMs are standalone, not connected to any network, and are tamper-resistant.`
  },
  {
    patterns: ["personal plan", "my plan", "help me", "what should i do"],
    response: `To generate your personalized voter action plan, use the **Election Strategy Simulator** above! 

Fill in:
- Whether you're a first-time voter
- Your registration status
- Days left before voting

I'll generate a step-by-step plan tailored specifically to your situation, complete with urgency signals and reasoning. 🎯`
  }
];

/* ── Intent detection & fallback response ──────────────────── */
export function getRuleBasedResponse(query) {
  const q = query.toLowerCase().trim();

  for (const rule of RULES) {
    if (rule.patterns.some(p => q.includes(p))) {
      return rule.response;
    }
  }

  // Generic fallback
  return `I'm here to help with everything related to elections and voting! You can ask me about:

- 📝 **Voter registration** — How and where to register
- 🗳️ **How to vote** — Step-by-step voting process
- 📄 **Required documents** — What ID to bring
- 📅 **Election timeline** — Phases and key dates
- 🏫 **Polling booth** — How to find your polling station
- ❓ **What-if scenarios** — "What if I miss voting day?"

Or use the **Election Strategy Simulator** above for a personalized action plan!`;
}

/* ── Unified query handler ─────────────────────────────────── */
export async function handleQuery(query) {
  const sanitized = sanitize(query);
  if (!sanitized) throw new Error("Please enter a valid question.");

  if (hasApiKey()) {
    try {
      return { source: "gemini", text: await callGemini(sanitized) };
    } catch (e) {
      console.warn("Gemini API error — falling back to rule-based:", e.message);
      return { source: "fallback", text: getRuleBasedResponse(sanitized) };
    }
  }

  return { source: "fallback", text: getRuleBasedResponse(sanitized) };
}

/* ── Basic sanitization ────────────────────────────────────── */
export function sanitize(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[^\w\s?.,'"\-!@#$%&*()\[\]]/g, "")
    .slice(0, 500);
}
