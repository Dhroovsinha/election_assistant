# 🗳️ AI Election Decision Assistant

> **Personalized voter guidance powered by Google Gemini AI**  
> Built for Google PromptWars — lightweight, context-aware, deployable on Cloud Run.

---

## 📌 Overview

The **AI Election Decision Assistant** is a smart, interactive web application that helps citizens understand the election process and takes it further — it generates **personalized voter action plans** based on each user's specific context. Whether you're a first-time voter with 2 days left or a returning voter who moved recently, the assistant adapts its guidance to your situation.

---

## ☁️ Google Services Used

### 1. 🤖 Google Gemini API (gemini-2.0-flash)

**Integration:** `js/assistant.js` — `callGemini()` and `handleQuery()`

- Model: **Gemini 2.0 Flash** via Google Generative Language REST API
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Called on **every user query** — always attempted first before any fallback
- Logs `console.log("Gemini API called")` on every invocation
- Response prefixed with `"AI Response (Gemini):"` and displayed in chat UI
- Graceful fallback to rule-based logic on API error with `console.log("Gemini failed → fallback")`

```js
// Gemini is ALWAYS called first — no gating
export async function callGemini(userMessage) {
  console.log("Gemini API called");
  const res = await fetch(`${GEMINI_ENDPOINT}`, { method: "POST", ... });
  return data.candidates[0].content.parts[0].text;
}
```

---

### 2. 🔥 Firebase Realtime Database

**Integration:** `js/assistant.js` — `saveToFirebase()` — called from `js/app.js` on every chat query

- **Service:** Firebase Realtime Database (project: `election-assistant-42bfd`)
- **SDK:** Firebase JS SDK v10 (ES module, loaded from `gstatic.com`)
- Every user query is written to the `queries/` path in real-time:

```js
await push(ref(_db, "queries"), { text: userInput, time: Date.now() });
console.log("Firebase write successful");
```

- UI displays `"✅ Saved to cloud database"` on every successful write
- Logs `console.log("Firebase write successful")` in console
- Gracefully degrades if DB is unreachable: `"☁️ Cloud save unavailable"`

| Firebase Detail | Value |
|---|---|
| Project ID | `election-assistant-42bfd` |
| Database | Realtime Database (default instance) |
| Write path | `queries/{pushId}` |
| Data stored | `{ text: string, time: timestamp }` |

---

### 3. 🚀 Google Cloud Run

**Integration:** `Dockerfile` + `nginx.conf`

- App is containerized with `nginx:alpine` — no server-side code, purely static files served by nginx
- Nginx configured to listen on **port 8080** (Cloud Run's required port)
- Zero-config deployment — no env vars or secrets needed at the container level

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY . /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
server {
  listen 8080;
  location / { root /usr/share/nginx/html; index index.html; }
}
```

**Deploy command:**
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/election-assistant
gcloud run deploy election-assistant \
  --image gcr.io/PROJECT_ID/election-assistant \
  --platform managed --region us-central1 \
  --allow-unauthenticated --port 8080
```

---

## 🎯 Core Feature — Election Strategy Simulator

The standout differentiator is the **Election Strategy Simulator**: a decision engine that collects three inputs and generates a fully personalized, step-by-step action plan.

**User inputs:**
- First-time voter or returning voter?
- Currently registered or not?
- How many days until voting day?

**Output:**
- Ordered steps (e.g., "Step 1: Check registration status", "Step 2: Gather documents")
- **Urgency signals**: `⚠️ Registration closes soon`, `⏳ Voting starts tomorrow`
- **Reasoning statement**: e.g., "Recommended based on: registration is incomplete, first-time voter needs document guidance"
- **Confidence score**: e.g., `87% Confidence`

### Decision Logic

```
if not registered AND days <= 30  → HIGH URGENCY: Register immediately
if first-time voter               → ADD: Document guide, candidate research, first-time tips
if days <= 1                      → EMERGENCY: Voting is tomorrow — act now
if days <= 3                      → ALERT: Limited time — prioritize key steps
if days > 30                      → STANDARD: Full preparation timeline
```

---

## 🧠 Decision Engine — Intent Detection

Pure JavaScript keyword matching across 8 intent categories — no NLP library needed.

| User Query | Detected Intent | Response Type |
|---|---|---|
| "how to vote" | `voting` | Step-by-step booth guide |
| "register" / "registration" | `registration` | Form 6 & NVSP portal guide |
| "document" / "ID" | `documents` | Approved ID list |
| "timeline" / "phases" | `timeline` | All 6 election phases |
| "miss voting" / "what if" | `whatif` | Postal ballot & next steps |
| "polling booth" / "location" | `booth` | voters.eci.gov.in guide |
| "first time" | `firsttime` | First-time voter welcome guide |
| "my plan" / "help me" | `plan` | Redirect to Simulator |

---

## 📅 Timeline View

| Phase | Name | Status |
|---|---|---|
| 1 | Voter Registration & Roll Revision | ✅ Done |
| 2 | Election Announcement & Campaigning | ✅ Done |
| 3 | Silent Period (48 hours before) | 🔵 Active |
| 4 | Voting Day | ⏳ Upcoming |
| 5 | Vote Counting & Results | ⏳ Upcoming |
| 6 | Government Formation | ⏳ Upcoming |

---

## ❓ What-If Scenarios

6 interactive accordion cards:
- "What if I miss voting day?" → Postal ballot + future planning
- "What if I'm not on the electoral roll?" → ERO / NVSP complaint process
- "What if I moved recently?" → Form 8A address update guide
- "What if I lose my Voter ID?" → e-EPIC download instructions
- "What if the EVM malfunctions?" → Presiding Officer escalation
- "What if I'm a student away from home?" → Registration options

---

## 🧪 Testing

On every page load, `runTests()` runs **real boolean assertions** and logs results:

```js
// Test 1: Strategy Simulator output
const plan = generatePlan({ firstTime: true, registered: false, days: 2 });
console.log(`TEST 1: ${plan.includes("Step 1") ? "PASSED" : "FAILED"}`);

// Test 2: Intent detection
const intent = detectIntent("how to vote");
console.log(`TEST 2: ${intent === "voting" ? "PASSED" : "FAILED"}`);

// Test 3: What-if response
const response = handleWhatIf("miss voting");
console.log(`TEST 3: ${response.length > 0 ? "PASSED" : "FAILED"}`);
```

**To verify:** Open DevTools → Console → look for `TEST 1/2/3: PASSED`

---

## 🔒 Security

- **Input validation**: Empty queries rejected with visual feedback
- **Sanitization**: HTML entities stripped, input capped at 500 characters
- **No eval / unsafe innerHTML**: All dynamic content goes through `escapeHtml()`

---

## ♿ Accessibility

- Semantic HTML5: `<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`
- All interactive elements: `aria-label` or `aria-labelledby`
- Skip navigation link for keyboard users
- `aria-live` regions for chat and plan output
- `aria-expanded` on collapsible scenario cards
- Fully keyboard navigable

---

## 📁 Project Structure

```
election_assistant/
├── index.html          # Semantic HTML, all sections, ARIA labels
├── css/
│   └── style.css       # Vanilla CSS, dark theme, responsive
├── js/
│   ├── app.js          # Strategy Simulator, Chat, What-If, Tests
│   └── assistant.js    # Gemini API, Firebase, fallback, sanitization
├── nginx.conf          # Nginx on port 8080 for Cloud Run
├── Dockerfile          # nginx:alpine, minimal image
├── .dockerignore
└── README.md
```

**Repository size: < 1 MB** (well under the 10 MB constraint)  
**Branch: main only**

---

## 🚀 Run Locally

```bash
# Python
python -m http.server 8080

# Docker
docker build -t election-assistant .
docker run -p 8080:8080 election-assistant
```

---

## ✅ Constraints Met

| Constraint | Status |
|---|---|
| Repository < 10 MB | ✅ < 1 MB |
| Single branch (main) | ✅ |
| No heavy frameworks | ✅ Vanilla HTML/CSS/JS ES modules |
| Cloud Run deployable | ✅ nginx:alpine on port 8080 |
| Gemini API integrated | ✅ Always called first, with fallback |
| Firebase integrated | ✅ Realtime DB write on every query |
| Public repository | ✅ |

---

## 🏆 Evaluation Criteria

| Criterion | Implementation |
|---|---|
| **Context-aware decision making** | Simulator adapts plan, urgency & confidence to 3 user inputs |
| **Personalized guidance** | Every plan is unique — dynamic step combinations |
| **Clear reasoning** | Explicit reasoning string + confidence % on every plan |
| **Practical usability** | Fallback works without API; covers all common voter questions |
| **Google Services — Gemini** | Gemini 2.0 Flash, always-first, labeled in UI |
| **Google Services — Firebase** | Realtime DB write on every query, UI confirmation |
| **Google Services — Cloud Run** | nginx:alpine container, port 8080, zero-config deploy |
| **Code quality** | ES modules, separated concerns, sanitized I/O |
| **Accessibility** | WCAG semantics, ARIA throughout, keyboard nav |

---

## 📞 Useful Resources

- [Election Commission of India](https://eci.gov.in)
- [NVSP Voter Registration Portal](https://nvsp.in)
- [Voter Helpline](https://voterportal.eci.gov.in) | Call **1950**
- [Google Gemini API](https://ai.google.dev)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [Google Cloud Run](https://cloud.google.com/run)

---

*Built with ❤️ for civic participation. Every vote matters. 🇮🇳*
