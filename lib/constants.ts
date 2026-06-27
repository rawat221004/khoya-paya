// Shared domain constants used by intake forms, search, seeding and matching.
//
// These reflect the Claude Impact Lab "Missing Persons at Kumbh Mela 2027"
// dataset (Nashik-Trimbakeshwar Simhastha). Locations are the 20 distinct
// `last_seen_location` values from Synthetic_Missing_Persons_2500.csv, geocoded
// to approximate Nashik-area coordinates so that identical / nearby places score
// correctly in the matching engine.

import type { GeoPoint } from "./types";

export const LOCATIONS: GeoPoint[] = [
  // Panchavati / Ramkund ghat cluster (Nashik old town, north of the Godavari)
  { label: "Ramkund Ghat", lat: 20.0083, lng: 73.791 },
  { label: "Laxmi Narayan Ghat", lat: 20.0075, lng: 73.7925 },
  { label: "Panchavati Circle", lat: 20.015, lng: 73.7967 },
  { label: "Kapila Sangam", lat: 20.0245, lng: 73.815 },
  { label: "Gauri Patangan", lat: 20.0135, lng: 73.806 },
  { label: "Sadhugram Gate 1", lat: 20.018, lng: 73.803 },
  { label: "Sadhugram Gate 2", lat: 20.0195, lng: 73.8055 },
  { label: "Main Police Chowki", lat: 19.9985, lng: 73.7892 },
  { label: "Bus Stand Nashik", lat: 19.997, lng: 73.776 },
  // Eastern / southern Nashik
  { label: "Madsangvi Transit", lat: 20.0, lng: 73.836 },
  { label: "Adgaon Parking", lat: 20.0155, lng: 73.8269 },
  { label: "Takli Sangam", lat: 19.975, lng: 73.81 },
  { label: "Dasak Ghat", lat: 19.965, lng: 73.829 },
  { label: "Nashik Road Station", lat: 19.946, lng: 73.84 },
  { label: "Nandur Ghat", lat: 20.04, lng: 73.855 },
  // Northern approaches
  { label: "Dindori Road Crossing", lat: 20.045, lng: 73.79 },
  { label: "Rajur Bahula", lat: 20.03, lng: 73.64 },
  // Trimbakeshwar (~28 km west of Nashik)
  { label: "Trimbak Road", lat: 19.97, lng: 73.73 },
  { label: "Trimbakeshwar Approach", lat: 19.9402, lng: 73.5295 },
  { label: "Kushavart Kund", lat: 19.9335, lng: 73.5305 },
];

export const LANGUAGES = [
  "Hindi",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Telugu",
  "Tamil",
  "Kannada",
  "Maithili",
  "Bhojpuri",
  "Awadhi",
  "Punjabi",
  "Nepali",
  "Malayalam",
  "English",
];

// Language families used by languageScore() for partial-credit scoring.
export const LANGUAGE_FAMILIES: Record<string, string> = {
  Hindi: "indo-aryan",
  Marathi: "indo-aryan",
  Gujarati: "indo-aryan",
  Bengali: "indo-aryan",
  Maithili: "indo-aryan",
  Bhojpuri: "indo-aryan",
  Awadhi: "indo-aryan",
  Punjabi: "indo-aryan",
  Nepali: "indo-aryan",
  Tamil: "dravidian",
  Telugu: "dravidian",
  Kannada: "dravidian",
  Malayalam: "dravidian",
  English: "germanic",
};

// Age bands match the dataset's `age_band` field exactly.
export const AGE_RANGES = [
  "0-12",
  "13-17",
  "18-40",
  "41-60",
  "61-70",
  "71-80",
  "80+",
];

export const GENDERS = ["male", "female", "other", "unknown"];

// States of origin (the dataset's `state` field). Used for the booth dropdown;
// imported records may carry any state string, which is fine.
export const REGIONS = [
  "Maharashtra",
  "Uttar Pradesh",
  "Bihar",
  "Madhya Pradesh",
  "Gujarat",
  "West Bengal",
  "Karnataka",
  "Tamil Nadu",
  "Kerala",
  "Delhi",
  "Rajasthan",
  "Punjab",
  "Andhra Pradesh",
  "Telangana",
  "Nepal",
];

// Lost-and-found centers from the dataset's `reporting_center` field. The whole
// point of the system is cross-center search, so we track which center filed a
// report.
export const REPORTING_CENTERS = [
  "Adgaon Kho-Ya-Paya",
  "Rajur Bahula Center",
  "Panchavati Center",
  "Ramkund Kho-Ya-Paya Kendra",
  "Bharat Bharati Control Room",
  "Trimbakeshwar Kho-Ya-Paya Kendra",
  "Central Control Room",
  "Nashik Road Center",
  "Sadhugram Lost Found",
  "Police Main Control Room",
];

export function findLocationByLabel(label: string): GeoPoint | null {
  const found = LOCATIONS.find(
    (l) => l.label.toLowerCase() === label.toLowerCase()
  );
  return found ?? null;
}
