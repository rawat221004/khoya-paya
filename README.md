# 🪔 Khoya Paya — Missing Persons Management System

A complete, locally-runnable full-stack web app for managing missing-person cases
at the Kumbh Mela. **It boots and works end-to-end even with no `ANTHROPIC_API_KEY`** —
every Claude-powered feature has a deterministic fallback. Add a key to switch those
features to real Claude responses.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (teal theme, mobile-first booth screens)
- **lowdb** — JSON-file database at `data/db.json`
- **bcryptjs** — password hashing
- Dependency-free **cookie sessions** (signed HMAC token + lowdb session store)
- **Recharts** — dashboard charts
- **Web Speech API** (SpeechSynthesis + SpeechRecognition) — Path B audio + text
- **@anthropic-ai/sdk** + **dotenv** — the Claude-powered features (Section below)
- Native `<input type="file">` + an API route saving photos to `public/uploads`

## Run it

```bash
cp .env.example .env.local     # then paste your real ANTHROPIC_API_KEY (optional)
npm install
npm run seed                   # staff + booth accounts, booth-logged demo cases, dataset import
npm run dev                    # http://localhost:3000
```

The app is fully clickable **before** you add the API key — Claude-powered fields
just show their fallback behaviour until the key is set.

Control how much of the dataset is imported:

```bash
SEED_IMPORT_LIMIT=1500 npm run seed   # import 1500 rows (default 800)
SEED_IMPORT_ALL=1 npm run seed        # import all 2500 rows
```

## Test accounts

**Staff Login** tab (admin / police):

| Role  | Username  | Password     | Lands on     |
|-------|-----------|--------------|--------------|
| admin | `admin`   | `Admin@123`  | `/dashboard` |
| police| `police1` | `Police@123` | `/police`    |

**Booth Login** tab — each booth IS a login, used by whichever volunteer is on shift.
Every case created during a booth session is stamped with that booth's id, name and
location (this powers the dashboard's hotspot-by-booth view):

| Booth                     | Username | Password    | Lands on |
|---------------------------|----------|-------------|----------|
| Ramkund Ghat Booth        | `booth1` | `Booth@123` | `/booth` |
| Trimbakeshwar Gate Booth  | `booth2` | `Booth@123` | `/booth` |

`middleware.ts` gates routes by login type: booth → `/booth/*`, police → `/police`,
admin → `/dashboard` (admin can view everything).

## Claude integration

`.env.local` holds the key and model:

```
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-sonnet-4-6
```

All Claude calls go through one wrapper — [lib/claude.ts](lib/claude.ts) `askClaude()` —
which returns `null` when there is no key or the call fails, so **every caller falls
back** and the app keeps working:

| Endpoint | With key | Fallback (no key) |
|----------|----------|-------------------|
| `POST /api/ai/structure-transcript` | Claude extracts age/gender/characteristics/language/location from a Path B transcript as strict JSON, prefilling the form | Naive regex extractor (numbers → age band, colour/clothing words → characteristics) |
| `POST /api/ai/explain-match` | Claude phrases the score breakdown as natural-language bullets, in the case's language | The rule-based `matchExplanation()` strings, unchanged |
| `POST /api/ai/smart-search` | Claude parses the query into a structured filter, then the **deterministic engine** ranks | Keyword/substring `smartSearch()` |
| `POST /api/ai/translate` | Claude translates case notes into the reader's language | Returns the original text + a "translation unavailable — no API key set" badge |
| `POST /api/ai/translate-ui` | Claude batch-translates the **whole interface** into the language picked in the navbar 🌐 switcher (cached in localStorage) | Returns the English originals unchanged |

**Claude never computes the match-confidence number.** All scoring math stays in
[lib/matching.ts](lib/matching.ts); Claude only handles language/text phrasing.

## Intake flows

- `/booth/path-a` — volunteer proxy intake for a child / unresponsive person.
- `/booth/path-b` — **elderly flow offering both audio AND text at every step**:
  language tiles (tap the name to select, or tap 🔊 to hear it), each question shown
  as text and spoken via SpeechSynthesis, each answer captured by mic **or** typed
  into the field below — both write the same value and are editable. If the browser
  lacks SpeechRecognition/SpeechSynthesis it degrades to a normal text form. Before
  submit, the raw answers are sent to `/api/ai/structure-transcript` to auto-fill the
  structured fields, which the volunteer reviews and can correct.
- `/booth/path-c` — standard flow: language → role → full form with photo upload.

## Matching engine

[lib/matching.ts](lib/matching.ts) runs automatically on every case creation.
Missing fields are excluded from the weighted average (geo 0.3, time 0.25,
demographic 0.25, language 0.2), never penalized.
`>= 90` → instant match · `40–89` → flagged for review · `< 40` → hidden.

## Dataset

This build ingests the **Claude Impact Lab — Mumbai 2026** dataset
([repo](https://github.com/SumeetGDoshi/claude-impact-labs-data/tree/main/claude-impact-lab-mumbai-2026)),
modelling missing persons at the **Nashik-Trimbakeshwar Simhastha Kumbh Mela 2027**.
The CSVs are vendored under [dataset/](dataset/) so the seed runs fully offline.

- **`Synthetic_Missing_Persons_2500.csv`** → imported as cases. `Reunited`→closed
  (with real `resolution_hours` so the dashboard's avg-resolution is live),
  `Pending`/`Unresolved`→open, `Transferred to hospital`→pending. Open records are
  auto-matched, surfacing the **cross-center duplicate** problem.
- **`Police_Stations.csv` / `CCTV_Locations.csv` / `Chokepoints_Parking.csv` /
  `Zone_Boundaries.csv`** → real Nashik geography ([lib/geodata.ts](lib/geodata.ts),
  `/api/geo`): nearest police station / chokepoint and CCTV coverage per case, plus
  ground-infrastructure stats on the dashboard.

## Multilingual interface + audio

- A 🌐 **language switcher** in the navbar re-translates the **entire UI** live into
  any of 14 languages, powered by Claude (`/api/ai/translate-ui`). Translations are
  cached in `localStorage`, so each string is translated once. Wrap any string in
  `<T>…</T>` ([components/LanguageProvider.tsx](components/LanguageProvider.tsx)) to
  make it translatable. With no API key the UI stays in English (graceful).
- **Path B questions** are translated into the *elderly person's* chosen intake
  language (separate from the volunteer's UI language) and **auto-played aloud** in
  that language via the Web Speech API — so the person reads *and* hears each
  question in their own tongue, and answers by voice or typing.

## What works

- **Tabbed login** (Staff / Booth); role-gated routes via `middleware.ts`.
- **Booth stamping** — booth-session cases carry `boothId`/`boothName`/location.
- **Three intake paths** including the dual audio+text Path B.
- **Case detail** (`/cases/[id]`) — ranked candidates with confidence % and
  explanation bullets (+ "✨ Explain this match" via Claude), Confirm/Reject,
  case timeline, the booth that logged it, and a translate-notes control.
- **Smart search** (`/cases`) — Claude-parsed when a key is set, keyword fallback
  otherwise; ranked by the same engine.
- **Dashboard** (`/dashboard`) — live counts, avg resolution time, hotspots,
  **hotspot-by-booth**, duplicate flags, and Recharts bar/line charts.
- **Police feed** (`/police`) — live, auto-refreshing open + escalated cases.

## Project layout

```
app/            App Router pages + API routes (incl. /api/ai/* and /api/geo)
components/     Navbar, form fields, badges, intake result
lib/            db, session, matching, search, claude, extract, cases, geodata, csv, constants, types
dataset/        Vendored Kumbh Mela 2027 CSVs (missing persons + geography)
scripts/seed.ts Seed script (npm run seed)
middleware.ts   Edge route protection (verifies signed session cookie)
data/db.json    Created by the seed script
public/uploads  Uploaded photos
```
