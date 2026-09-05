# Solaris-Score (SuryaSetu) — Repository Analysis

**Target:** https://github.com/husainbadri/Solaris-score (canonical: `husainbadri/solaris-score`)
**Reviewed at:** commit `1ad4047` — *"feat: complete Solaris score platform with advanced solar intelligence and calculators"* (the only commit on `main`)
**Date:** 2026-09-05

---

## 1. What it is

A single-page React app plus one Cloudflare Worker, branded **SuryaSetu** — an India-focused
solar decision engine. A homeowner scans an electricity bill, the app extracts DISCOM /
units / amount via a vision model, then sizes a rooftop array, prices it against MNRE
benchmarks, applies the PM Surya Ghar subsidy, and projects 25 years of savings. Around it
sit a vendor marketplace, an anonymous RFQ/bidding flow, a loan calculator, a time-of-day
battery simulator, a Leaflet roof-tracing tool, and a printable subsidy application.

**Scale:** 110 tracked files, ~18.9k lines of TS/TSX (~21k including CSS/JSON), 1.5 MB working tree.

---

## 2. Stack

| Layer | Choice |
| --- | --- |
| UI | React 19.2, TypeScript ~6.0, Vite 8 |
| Routing | react-router-dom **7.18** (README says v6) |
| Charts | Chart.js 4 + react-chartjs-2, wrapped in a local `ui/bklit` kit |
| Maps | Leaflet 1.9 / react-leaflet 5, OSM + ArcGIS World Imagery tiles |
| AI | `openai` SDK against an OpenAI-compatible endpoint; NVIDIA + Gemini vision chains |
| Backend | Cloudflare Worker (`src/worker.ts`, 371 lines) + D1 (`suryasetu-db`) |
| Tooling | oxlint, vitest 5, Vercel SPA rewrite |

---

## 3. Verified build health

Everything was installed and run against the checked-out tree:

| Check | Result |
| --- | --- |
| `npm ci` | clean, 193 packages, ~10 s |
| `npm test` (vitest) | **295 tests / 19 files, all passing** (17 s) |
| `npm run build` (`tsc -b && vite build`) | **succeeds**, 1.74 s |
| `npm run lint` (oxlint) | 0 errors, **3 warnings** |

Lint warnings: unused `useEffect` import in `Dashboard.tsx:1`, an unnecessary `useMemo`
dependency in `ToDBatterySimulator.tsx:184`, and a fast-refresh export warning in
`AppContext.tsx:204`. All cosmetic.

**Bundle sizes** (gzip): `SolarAI` 113 kB, `useChartTheme` (Chart.js) 66 kB,
`PropertyAssessment` (Leaflet) 57 kB, entry 88 kB. Routes are lazily loaded, which is right,
but the two heavy vendor libraries are each pulled whole into a single route chunk.

---

## 4. Architecture

```
src/
├── pages/        8 route-level screens (Landing, Auth, Onboarding, Dashboard,
│                 SolarAI, PropertyAssessment, AISolarReport, VendorMarketplace)
├── components/   12 feature components + ui/bklit chart primitives
├── services/     19 modules — the actual domain layer
├── data/         static tariff / irradiance / scheme / vendor tables (20 states)
├── knowledge/    2 JSON policy corpora fed into the AI system prompt
├── demo/         DEMO_MODE scaffolding (presets, scripted auction)
├── i18n/         en / hi / mr
└── worker.ts     Cloudflare Worker: GET /api/health, POST /api/bills/scan
```

The design is sound: pages are thin, all arithmetic lives in `services/`, and
`services/profile.ts` centralises the messy alias groups on `UserProfile`
(`billSize`/`avgBill`/`billAmount`, `roofArea`/`roofSqFt`, `pinCode`/`pincode`) instead of
letting every call site coerce them. Every component and service is actually reachable —
no dead modules.

**It is effectively a client-only app.** State lives in `AppContext` + `localStorage`;
records live in IndexedDB (`suryx_relational_local_db`, 8 stores). The Worker exists solely
to hold the vision API keys and log OCR results.

### The ROI engine is the strongest code here

`services/roiCalculator.ts` (294 lines) is genuinely careful work, not a demo prop:

- Consumption is recovered by **inverting the telescoping slab table**, not dividing by a
  flat tariff — with a code comment giving the concrete Nagpur MSEDCL bill (345 units,
  ₹5,960) where the naive method returns 676 units and oversizes 3.5 kW → 6.5 kW.
- A **calibration factor** (clamped 0.5–4×) reconciles modelled energy charges against the
  scanned bill's real total, capturing fixed charges, wheeling, FAC and duty.
- Generation uses per-state irradiance × 0.82 BOS × **climate thermal derating**, not one
  national peak-sun-hours number.
- Sizing is capped at **1.5× sanctioned load** (CEA net-metering headroom) and savings at
  **90% of the bill** — you can't offset fixed charges or evening load without storage.
- 25-year projection carries 7.8% tariff escalation, 0.5%/yr degradation, ₹500/kW/yr O&M.
- The PM Surya Ghar subsidy table (₹30k/₹60k/₹78k, capped) matches the Feb-2024 MNRE OM.

`services/solarScorer.ts` is similarly documented, including a comment explaining a fixed
non-monotonicity bug (unknown roof area used to outrank a known small roof).

---

## 5. Findings

### 🔴 High — the OCR mock is indistinguishable from a real scan

`services/billScanner.ts:583` and `worker.ts:216` both return a **hardcoded bill** when
every vision path fails:

```
BESCOM · consumer 5849201948 · 342 units · ₹3,240 · 3.5 kW sanctioned
extractedSuccessfully: true
```

The Worker at least labels it `Solar Vision AI (Offline Mock)`; the client path labels it
plain `"Solar Vision AI"` and reports `extractedSuccessfully: true`. That fabricated bill
then flows into sizing, subsidy, payback and the printable PM Surya Ghar application — a
user can be shown a confident 25-year financial projection built entirely on someone else's
invented meter reading. This is a correctness problem, not a styling one: the fallback
should surface as a failure state, or at minimum carry an unmistakable flag the UI must render.

Related: the Worker writes `confidence: 0.95` unconditionally, mock included.

### 🔴 High — `/api/bills/scan` is unauthenticated and wide open

`worker.ts` serves `Access-Control-Allow-Origin: *` with no auth, no rate limit, and no
payload size cap. Anyone who finds the URL can post arbitrary images and:

1. burn the NVIDIA / Gemini quota those server-side secrets pay for (the NVIDIA call
   requests `max_tokens: 65536` with a 16k reasoning budget — for a seven-field JSON
   extraction, so each abusive request is expensive);
2. write unbounded rows into D1, since every insert hardcodes `user_id: 'anonymous_user'`.

Minimum fixes: an origin allowlist instead of `*`, a request-size ceiling, Cloudflare rate
limiting, and a far smaller `max_tokens`.

### 🟠 Medium — bill PII in D1 with no owner and no retention

`bill_extractions` stores consumer number, DISCOM, billing period and **raw OCR text** of
real electricity bills, all under `anonymous_user`. Nothing associates a row with the person
who uploaded it, so nothing can delete it on request. Add a real user id (or drop
`raw_ocr_text`) and a TTL.

### 🟠 Medium — hardcoded endpoint + key in the client bundle

`services/ai.ts:13-14` ships a Cloudflare quick-tunnel URL and the literal key
`sk-suryx-custom-key` as the fallback when `VITE_OMNI_API_BASE` is unset. The comment
correctly warns the tunnel rotates, but the credential still ends up in every built asset.
`.env.example` repeats the same tunnel URL as if it were a default. Treat the missing
env var as a hard configuration error rather than shipping a placeholder credential.

The *vision* keys, by contrast, are handled well: `billScanner.ts:527` gates the direct
browser→NVIDIA/Gemini path behind `import.meta.env.DEV || VITE_ALLOW_CLIENT_VISION_KEYS`,
with an accurate comment about Vite inlining `VITE_*` into the bundle. That's the right
instinct — `ai.ts` just hasn't been held to it.

### 🟠 Medium — the RFQ "privacy guarantee" is client-side only

`RFQMarketplace.tsx:370` tells the user *"Your contact info and exact address remain
completely hidden… only unlocked when you accept a bid."* Bids and vendor contacts are
local IndexedDB / static mock data, so nothing enforces that; it is a UX demonstration of a
policy, not the policy. Fine as a hackathon demo, but the wording reads as a security
guarantee and should be softened until a server enforces it.

### 🟡 Low — repo hygiene

- **`wrangler` is not a dependency.** README instructs `npx wrangler deploy` / `dev`, and
  `wrangler.json` `$schema`-references `node_modules/wrangler/config-schema.json`, but the
  package is absent from `package.json`. Add it to devDependencies and pin it.
- **No `LICENSE` file** despite the README declaring MIT.
- **No CI** — no `.github/`. The suite is green and fast (17 s); nothing runs it on push.
- **Single squashed commit.** No history, no blame, no review trail on ~19k lines.
- **README drift:** the Quick Start clones `abubakarop461-bit/2026_OutgrowX`, not this repo;
  it says React Router v6 (it's 7); it describes a light-only theme while a full
  light/dark/system theme (`ThemeToggle`, `resolvedTheme`) is implemented.
- `wrangler.json` commits the D1 `database_id` — not a secret, but it names the live instance.
- Test coverage is **service- and data-layer only**. 295 tests and not one renders a
  component: routing, `ProtectedRoute`, `ErrorBoundary` and all chart wiring are untested,
  as is `worker.ts`.

### Note, not a defect — "authentication" is a flag

`ProtectedRoute` checks `isAuthenticated`, which is set by `Auth.tsx` handing name/phone/email
to `authenticateUser` and persisting `suryx_authenticated=true` in localStorage. There is no
password, no verification, no session. For a single-device local-storage app with no server
data to protect, that is a defensible scope decision — it only becomes a vulnerability the
moment any real per-user server state exists.

---

## 6. Assessment

This is a well-organised, working application with an unusually rigorous domain core. The
ROI and scoring models are documented against real sources (MNRE benchmarks, CERC escalation,
CEA net-metering rules) and defended with comments explaining bugs already fixed — that is
the mark of someone who actually validated the numbers against real bills. Build, tests and
lint are all green as checked out.

The gap is between that core and its edges. The financial engine is careful; the data path
feeding it can silently substitute a fabricated bill. The vision keys are correctly kept
server-side; the chat endpoint's key is hardcoded into the bundle. The privacy model is
convincingly presented; nothing enforces it.

**Priority order:** (1) make the OCR mock impossible to mistake for a real scan, (2) lock
down `/api/bills/scan`, (3) attach an owner and a retention policy to stored bill data,
(4) remove the hardcoded fallback credential, (5) add CI and a LICENSE.
