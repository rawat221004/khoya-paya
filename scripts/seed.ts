// Seeds data/db.json with the test staff + booth accounts, a set of curated demo
// cases (booth-stamped, with guaranteed clean matches for a quick walkthrough),
// and an import of the Claude Impact Lab "Missing Persons at Kumbh Mela 2027"
// dataset (Nashik-Trimbakeshwar).
//
// Run with: npm run seed
//   SEED_IMPORT_LIMIT=1500 npm run seed   # import more dataset rows
//   SEED_IMPORT_ALL=1 npm run seed        # import all 2500 rows

import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { getDb, defaultData, newId } from "../lib/db";
import { createCaseWithMatching, NewCaseInput } from "../lib/cases";
import { findLocationByLabel } from "../lib/constants";
import { parseCsv } from "../lib/csv";
import type { Booth, CaseStatus, User } from "../lib/types";

function loc(label: string) {
  const l = findLocationByLabel(label);
  if (!l) throw new Error(`Unknown seed location: ${label}`);
  return { ...l };
}

const BASE = Date.now();
function hoursAgo(h: number): string {
  return new Date(BASE - h * 3600 * 1000).toISOString();
}

// Booth ids — referenced by the curated cases below.
const BOOTH1 = "booth_ramkund";
const BOOTH2 = "booth_trimbak";
const BOOTH1_NAME = "Ramkund Ghat Booth";
const BOOTH2_NAME = "Trimbakeshwar Gate Booth";

// Stamp a curated case as logged by a given booth.
function byBooth(boothId: string, boothName: string) {
  return {
    boothId,
    boothName,
    createdBy: boothId,
    creatorKind: "booth" as const,
  };
}

// ---- dataset mapping helpers ---------------------------------------------

function mapGender(g: string): string {
  const v = (g || "").toLowerCase();
  if (v === "male") return "male";
  if (v === "female") return "female";
  return "unknown";
}

function mapStatus(s: string): { status: CaseStatus; reunited: boolean } {
  const v = (s || "").toLowerCase();
  if (v === "reunited") return { status: "closed", reunited: true };
  if (v === "transferred to hospital") return { status: "matched_pending", reunited: false };
  // Pending / Unresolved / anything else
  return { status: "open", reunited: false };
}

function parseDatasetDate(raw: string): string {
  // dataset format: "YYYY-MM-DD HH:MM"
  const iso = raw.includes(" ") ? raw.replace(" ", "T") + ":00" : raw;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function addHoursISO(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3600 * 1000).toISOString();
}

async function main() {
  const db = await getDb();
  db.data = structuredClone(defaultData);

  // --- Staff users (admin + police only; booths are separate logins) -------
  const userSpecs: Array<Omit<User, "passwordHash"> & { password: string }> = [
    { id: "user_admin", username: "admin", password: "Admin@123", role: "admin", name: "Control Room Admin" },
    { id: "user_pol1", username: "police1", password: "Police@123", role: "police", name: "Inspector Rao" },
  ];
  for (const u of userSpecs) {
    db.data.users.push({
      id: u.id,
      username: u.username,
      passwordHash: bcrypt.hashSync(u.password, 10),
      role: u.role,
      name: u.name,
    });
  }

  // --- Booths (each booth IS a login) --------------------------------------
  const boothSpecs: Array<Omit<Booth, "passwordHash"> & { password: string }> = [
    { id: BOOTH1, username: "booth1", password: "Booth@123", name: BOOTH1_NAME, location: loc("Ramkund Ghat") },
    { id: BOOTH2, username: "booth2", password: "Booth@123", name: BOOTH2_NAME, location: loc("Trimbakeshwar Approach") },
  ];
  for (const b of boothSpecs) {
    db.data.booths.push({
      id: b.id,
      username: b.username,
      passwordHash: bcrypt.hashSync(b.password, 10),
      name: b.name,
      location: b.location,
    });
  }

  // --- Dataset import ------------------------------------------------------
  const csvPath = path.join(process.cwd(), "dataset", "Synthetic_Missing_Persons_2500.csv");
  let imported = 0;
  let importedOpen = 0;
  if (fs.existsSync(csvPath)) {
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const all = process.env.SEED_IMPORT_ALL === "1";
    const limit = all ? rows.length : parseInt(process.env.SEED_IMPORT_LIMIT || "800", 10);

    for (const row of rows.slice(0, limit)) {
      const { status, reunited } = mapStatus(row.status);
      const createdAt = parseDatasetDate(row.reported_at);
      const location = findLocationByLabel(row.last_seen_location);

      const input: NewCaseInput = {
        intakePath: "C_standard",
        role: "reporter",
        status,
        createdAt,
        timeReported: createdAt,
        photoUrl: null,
        location,
        language: row.language || null,
        region: row.state || null,
        district: row.district || null,
        ageRange: row.age_band || null,
        gender: mapGender(row.gender),
        characteristics: row.physical_description || "(no description provided)",
        reporterName: null,
        reporterContact: row.reporter_mobile || null,
        rawTranscript: null,
        personName: row.missing_person_name || null,
        reportingCenter: row.reporting_center || null,
        externalId: row.case_id || null,
        isDuplicate: (row.is_duplicate_report || "").toLowerCase() === "true",
        source: "dataset",
        createdBy: "user_admin",
        creatorKind: "user",
      };

      // Only run matching for still-open records (resolved ones don't need
      // review candidates). This is what surfaces cross-center duplicates.
      const runMatching = status === "open";
      createCaseWithMatching(db, input, { runMatching, maxCandidates: 10 });
      imported++;
      if (runMatching) importedOpen++;

      // For resolved (reunited) records, record the outcome at the dataset's
      // resolution time so the dashboard's average-resolution metric is real.
      if (reunited) {
        const last = db.data.cases[db.data.cases.length - 1];
        const hrs = parseFloat(row.resolution_hours);
        if (Number.isFinite(hrs) && hrs >= 0) {
          db.data.auditLog.push({
            id: newId("audit"),
            caseId: last.id,
            action: `Reunited — resolved in ${hrs} h (imported outcome)`,
            byUserId: "user_admin",
            timestamp: addHoursISO(createdAt, hrs),
          });
        }
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(`Dataset CSV not found at ${csvPath} — skipping import.`);
  }

  // --- Curated demo cases (booth-stamped; guaranteed clean matches) --------
  // Created "now" and scored against everything already imported, so each
  // produces a visible candidate list immediately. Spread across both booths so
  // the dashboard's hotspot-by-booth view shows real activity.
  const demo: NewCaseInput[] = [
    // Pair 1 — reporter looking for elderly father (strong match w/ #2).
    {
      intakePath: "C_standard", role: "reporter", createdAt: hoursAgo(3), timeReported: hoursAgo(3),
      location: loc("Ramkund Ghat"), language: "Marathi", region: "Maharashtra", district: "Nashik",
      ageRange: "71-80", gender: "male",
      characteristics: "Elderly man, white kurta, walking stick, hard of hearing.",
      reporterName: "Suresh Patil", reporterContact: "+91 90000 11111",
      reportingCenter: "Ramkund Kho-Ya-Paya Kendra", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // Pair 2 — self-missing elderly man found wandering (matches #1).
    {
      intakePath: "B_elderly", role: "self_missing", createdAt: hoursAgo(2.5), timeReported: hoursAgo(2.5),
      location: loc("Laxmi Narayan Ghat"), language: "Marathi", region: "Maharashtra",
      ageRange: "71-80", gender: "male",
      characteristics: "Confused elderly man with a wooden walking stick, white clothes.",
      rawTranscript: "Q: What is your name?\nA: My name is Ganpat.\nQ: Who did you come with?\nA: I came with my son, I cannot find him. I am from Pune.",
      structuredByClaude: false,
      reportingCenter: "Panchavati Center", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // Pair 3 — child reported by mother (matches #4).
    {
      intakePath: "C_standard", role: "reporter", createdAt: hoursAgo(1), timeReported: hoursAgo(1),
      location: loc("Panchavati Circle"), language: "Hindi", region: "Uttar Pradesh", district: "Varanasi",
      ageRange: "0-12", gender: "male",
      characteristics: "Boy in red t-shirt and blue shorts, mole on left cheek, about 8 years.",
      reporterName: "Kavita Devi", reporterContact: "+91 90000 22222",
      reportingCenter: "Panchavati Center", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // Pair 4 — found child, proxy intake (matches #3).
    {
      intakePath: "A_child", role: "reported", createdAt: hoursAgo(0.7), timeReported: hoursAgo(0.7),
      location: loc("Gauri Patangan"), language: "Hindi",
      ageRange: "0-12", gender: "male",
      characteristics: "Small boy crying, red shirt, blue shorts, found near the Tapovan barricade.",
      reporterName: "Volunteer Asha", reportingCenter: "Sadhugram Lost Found", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // 5 — very sparse case (only location + time + partial desc).
    {
      intakePath: "A_child", role: "reported", createdAt: hoursAgo(2.8), timeReported: hoursAgo(2.8),
      location: loc("Ramkund Ghat"), language: null, ageRange: null, gender: null,
      characteristics: "Person found disoriented near Ramkund steps. Details pending.",
      reporterName: "Volunteer Asha", reportingCenter: "Ramkund Kho-Ya-Paya Kendra", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // Pair 6 & 7 — elderly Tamil woman: reporter (daughter) + self-missing.
    {
      intakePath: "C_standard", role: "reporter", createdAt: hoursAgo(9.5), timeReported: hoursAgo(9.5),
      location: loc("Kushavart Kund"), language: "Tamil", region: "Tamil Nadu", district: "Madurai",
      ageRange: "71-80", gender: "female",
      characteristics: "My mother, maroon saree, thick spectacles, speaks only Tamil.",
      reporterName: "Lakshmi", reporterContact: "+91 90000 33333",
      reportingCenter: "Trimbakeshwar Kho-Ya-Paya Kendra", ...byBooth(BOOTH2, BOOTH2_NAME),
    },
    {
      intakePath: "B_elderly", role: "self_missing", createdAt: hoursAgo(9), timeReported: hoursAgo(9),
      location: loc("Trimbakeshwar Approach"), language: "Tamil", region: "Tamil Nadu", ageRange: "71-80", gender: "female",
      characteristics: "Elderly woman, speaks only Tamil, wearing spectacles and a maroon saree.",
      rawTranscript: "Q: What is your name?\nA: Naan Meenakshi.\nQ: Who are you looking for?\nA: Naan en magalai thedukiren. (I am looking for my daughter.)",
      structuredByClaude: false,
      reportingCenter: "Trimbakeshwar Kho-Ya-Paya Kendra", ...byBooth(BOOTH2, BOOTH2_NAME),
    },
    // 8 — Gujarati man, standard intake at Trimbakeshwar.
    {
      intakePath: "C_standard", role: "reporter", createdAt: hoursAgo(5.2), timeReported: hoursAgo(5.2),
      location: loc("Trimbak Road"), language: "Gujarati", region: "Gujarat", district: "Surat",
      ageRange: "41-60", gender: "male",
      characteristics: "Middle-aged man in a cream shirt, carrying a brown cloth bag.",
      reporterName: "Bhavesh Shah", reporterContact: "+91 90000 44444",
      reportingCenter: "Trimbakeshwar Kho-Ya-Paya Kendra", ...byBooth(BOOTH2, BOOTH2_NAME),
    },
    // 9 — found elderly man near Trimbakeshwar (partial match to #8 region/age).
    {
      intakePath: "A_child", role: "reported", createdAt: hoursAgo(4.8), timeReported: hoursAgo(4.8),
      location: loc("Trimbakeshwar Approach"), language: "Gujarati", ageRange: "41-60", gender: "male",
      characteristics: "Disoriented man, cream-coloured shirt, no bag, found near the temple queue.",
      reporterName: "Volunteer Ravi", reportingCenter: "Trimbakeshwar Kho-Ya-Paya Kendra", ...byBooth(BOOTH2, BOOTH2_NAME),
    },
    // 10 — Bengali woman, standard intake, Ramkund.
    {
      intakePath: "C_standard", role: "reporter", createdAt: hoursAgo(6.5), timeReported: hoursAgo(6.5),
      location: loc("Kapila Sangam"), language: "Bengali", region: "West Bengal", district: "Kolkata",
      ageRange: "18-40", gender: "female",
      characteristics: "Young woman, green salwar kameez, gold bangles, scar on right hand.",
      reporterName: "Anjan Das", reporterContact: "+91 90000 55555",
      reportingCenter: "Bharat Bharati Control Room", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // 11 — elderly Hindi man, audio intake, Trimbakeshwar.
    {
      intakePath: "B_elderly", role: "self_missing", createdAt: hoursAgo(7.7), timeReported: hoursAgo(7.7),
      location: loc("Trimbakeshwar Approach"), language: "Hindi", region: "Madhya Pradesh", ageRange: "61-70", gender: "male",
      characteristics: "Older man, saffron dhoti, bald, deaf in one ear.",
      rawTranscript: "Q: What is your name?\nA: Mera naam Ramprasad hai.\nQ: Which place are you from?\nA: Main Ujjain se hoon.",
      structuredByClaude: false,
      reportingCenter: "Trimbakeshwar Kho-Ya-Paya Kendra", ...byBooth(BOOTH2, BOOTH2_NAME),
    },
    // 12 — teen girl reported, Ramkund.
    {
      intakePath: "C_standard", role: "reporter", createdAt: hoursAgo(2.1), timeReported: hoursAgo(2.1),
      location: loc("Panchavati Circle"), language: "Marathi", region: "Maharashtra", district: "Nashik",
      ageRange: "13-17", gender: "female",
      characteristics: "Teenage girl, blue school dress, carrying a yellow umbrella.",
      reporterName: "Sunita More", reporterContact: "+91 90000 66666",
      reportingCenter: "Panchavati Center", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // 13 — found teen girl (partial match to #12).
    {
      intakePath: "A_child", role: "reported", createdAt: hoursAgo(1.6), timeReported: hoursAgo(1.6),
      location: loc("Sadhugram Gate 1"), language: "Marathi", ageRange: "13-17", gender: "female",
      characteristics: "Girl in a blue dress with a yellow umbrella, looking for her mother.",
      reporterName: "Volunteer Asha", reportingCenter: "Sadhugram Lost Found", ...byBooth(BOOTH1, BOOTH1_NAME),
    },
    // 14 — sparse Trimbakeshwar case (only language + location).
    {
      intakePath: "B_elderly", role: "self_missing", createdAt: hoursAgo(11), timeReported: hoursAgo(11),
      location: loc("Kushavart Kund"), language: "Marathi", ageRange: null, gender: null,
      characteristics: "Elderly person found near Kushavart, unable to give clear details.",
      rawTranscript: "Q: What is your name?\nA: (no clear answer)",
      structuredByClaude: false,
      reportingCenter: "Trimbakeshwar Kho-Ya-Paya Kendra", ...byBooth(BOOTH2, BOOTH2_NAME),
    },
  ];

  for (const c of demo) {
    createCaseWithMatching(db, c, { maxCandidates: 12 });
  }

  await db.write();

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${db.data.users.length} staff users, ${db.data.booths.length} booths, ` +
      `${db.data.cases.length} cases (${imported} imported from dataset, ` +
      `${importedOpen} open & matched, ${demo.length} curated booth-logged demo), ` +
      `${db.data.matchCandidates.length} match candidates into data/db.json`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
