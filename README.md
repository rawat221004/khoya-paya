# 🪔 Kumbh Setu — Missing Persons Management System

A complete, locally-runnable full-stack web app for managing missing-person cases
at the Kumbh Mela. No external API keys or cloud services required.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (teal theme, mobile-first booth screens)
- **lowdb** — JSON-file database at `data/db.json`
- **bcryptjs** — password hashing
- Dependency-free **cookie sessions** (signed HMAC token + lowdb session store)
- **Recharts** — dashboard charts
- **Web Speech API** (SpeechSynthesis + SpeechRecognition) for the elderly audio path
- Native `<input type="file">` + an API route saving photos to `public/uploads`

## Run it

```bash
npm install
npm run seed     # users + 6 curated demo cases + 800 imported dataset records
npm run dev      # http://localhost:3000
```

Control how much of the dataset is imported:

```bash
SEED_IMPORT_LIMIT=1500 npm run seed   # import 1500 rows (default 800)
SEED_IMPORT_ALL=1 npm run seed        # import all 2500 rows
```

## Dataset

This build ingests the **Claude Impact Lab — Mumbai 2026** dataset
([repo](https://github.com/SumeetGDoshi/claude-impact-labs-data/tree/main/claude-impact-lab-mumbai-2026)),
modelling missing persons at the **Nashik-Trimbakeshwar Simhastha Kumbh Mela 2027**.
The CSVs are vendored under [dataset/](dataset/) so the seed runs fully offline.

- **`Synthetic_Missing_Persons_2500.csv`** → imported as real cases. Each row maps
  to a case (name, gender, age band, state/district, language, last-seen location,
  reporting center, mobile, physical description, status). `Reunited`→closed (with
  the real `resolution_hours` recorded so the dashboard's avg-resolution is live),
  `Pending`/`Unresolved`→open, `Transferred to hospital`→pending. The `is_duplicate_report`
  flag is preserved. Open records are auto-matched, surfacing the **cross-center
  duplicate** problem the dataset is built around.
- **`Police_Stations.csv` / `CCTV_Locations.csv` / `Chokepoints_Parking.csv` /
  `Zone_Boundaries.csv`** → real Nashik geography, used by [lib/geodata.ts](lib/geodata.ts)
  and `/api/geo` to show the **nearest police station**, **nearest chokepoint**, and
  **CCTV coverage** for any case location (on the case detail page), plus ground-
  infrastructure stats on the dashboard.

The 20 booth/search locations and the language/age-band vocabularies all match the
dataset exactly, so newly registered cases match cleanly against imported records.

## Test accounts

| Role      | Username     | Password       | Lands on     |
|-----------|--------------|----------------|--------------|
| admin     | `admin`      | `Admin@123`    | `/dashboard` |
| volunteer | `volunteer1` | `Volunteer@123`| `/booth`     |
| police    | `police1`    | `Police@123`   | `/police`    |

## What works

- **Login** for all 3 accounts, role-gated routes via `middleware.ts`.
- **Three intake paths**:
  - `/booth/path-a` — volunteer proxy intake for a child / unresponsive person.
  - `/booth/path-b` — elderly audio flow: language tiles spoken aloud, questions
    played via SpeechSynthesis, answers captured via SpeechRecognition (falls back
    to typing if the browser lacks support), editable transcript before submit.
  - `/booth/path-c` — standard flow: language → role → full form with photo upload.
- **Matching engine** (`lib/matching.ts`) runs automatically on every case
  creation. Missing fields are excluded from the weighted average, never penalized.
  - `>= 90` → instant match, `40–89` → flagged for volunteer review, `< 40` → hidden.
- **Case detail** (`/cases/[id]`) shows ranked candidates with confidence % and
  explanation bullets, Confirm/Reject buttons, and a case timeline.
- **Smart search** (`/cases`) — free-text box (e.g. *"white kurta, walking stick,
  Marathi, near Ramkund"*) scored by the same engine.
- **Dashboard** (`/dashboard`) — live counts, average resolution time, hotspots,
  duplicate-report flags, and Recharts bar/line charts.
- **Police feed** (`/police`) — live, auto-refreshing list of open + escalated cases.

## Project layout

```
app/            App Router pages + API routes (incl. /api/geo)
components/     Navbar, form fields, badges, intake result
lib/            db, session, matching, search, case helpers, geodata, csv, constants, types
dataset/        Vendored Kumbh Mela 2027 CSVs (missing persons + geography)
scripts/seed.ts Seed script (npm run seed)
middleware.ts   Edge route protection (verifies signed session cookie)
data/db.json    Created by the seed script
public/uploads  Uploaded photos
```
