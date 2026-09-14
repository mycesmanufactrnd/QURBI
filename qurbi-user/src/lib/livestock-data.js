// UI constants only — all business data (categories, breeds, prices) comes from the database

export const GRADES = ["AA", "A", "B", "C", "D"];

export const GRADE_COLORS = {
  AA: "bg-emerald-600 text-white",
  A: "bg-green-500 text-white",
  B: "bg-lime-500 text-white",
  C: "bg-yellow-500 text-white",
  D: "bg-orange-400 text-white",
};

export const GRADE_DESCRIPTIONS = {
  AA: "Premium — Show quality, top condition",
  A: "Grade A — Excellent condition",
  B: "Grade B — Good condition",
  C: "Grade C — Standard",
  D: "Grade D — Economy",
};

// Weight ranges (kg) per animal category per grade — display spec
export const WEIGHT_TABLE = {
  Cow: {
    AA: { min: 550, max: 700 },
    A: { min: 450, max: 550 },
    B: { min: 350, max: 450 },
    C: { min: 250, max: 350 },
    D: { min: 150, max: 250 },
  },
  Lamb: {
    AA: { min: 45, max: 60 },
    A: { min: 35, max: 45 },
    B: { min: 25, max: 35 },
    C: { min: 18, max: 25 },
    D: { min: 10, max: 18 },
  },
  Goat: {
    AA: { min: 50, max: 70 },
    A: { min: 38, max: 50 },
    B: { min: 28, max: 38 },
    C: { min: 20, max: 28 },
    D: { min: 12, max: 20 },
  },
  Buffalo: {
    AA: { min: 650, max: 850 },
    A: { min: 500, max: 650 },
    B: { min: 380, max: 500 },
    C: { min: 280, max: 380 },
    D: { min: 180, max: 280 },
  },
  Camel: {
    AA: { min: 650, max: 900 },
    A: { min: 500, max: 650 },
    B: { min: 380, max: 500 },
    C: { min: 280, max: 380 },
    D: { min: 180, max: 280 },
  },
};

export const SPECIES_EMOJIS = {
  Cow: "🐄",
  Goat: "🐐",
  Buffalo: "🐃",
  Sheep: "🐑",
  Lamb: "🐑",
  Camel: "🐪",
  Horse: "🐎",
};

export const STATUS_COLORS = {
  Available: "bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-black",
  Sold: "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white",
  Reserved: "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white",
};

// Malaysian states — keyword variants mapped to canonical label
export const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Pulau Pinang",
  "Perak",
  "Perlis",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Putrajaya",
  "Labuan",
];

const STATE_ALIASES = {
  johor: "Johor",
  johore: "Johor",
  kedah: "Kedah",
  kelantan: "Kelantan",
  melaka: "Melaka",
  malacca: "Melaka",
  "negeri sembilan": "Negeri Sembilan",
  ns: "Negeri Sembilan",
  pahang: "Pahang",
  "pulau pinang": "Pulau Pinang",
  penang: "Pulau Pinang",
  pinang: "Pulau Pinang",
  perak: "Perak",
  perlis: "Perlis",
  sabah: "Sabah",
  sarawak: "Sarawak",
  selangor: "Selangor",
  terengganu: "Terengganu",
  "kuala lumpur": "Kuala Lumpur",
  kl: "Kuala Lumpur",
  putrajaya: "Putrajaya",
  labuan: "Labuan",
};

// Extracts the Malaysian state from a free-text location string.
// Returns the canonical state label, or "" if no match.
export function extractState(location) {
  if (!location) return "";
  const lower = location.toLowerCase();
  // Check multi-word aliases first to avoid partial matches (e.g. "negeri sembilan")
  for (const [alias, state] of Object.entries(STATE_ALIASES)) {
    if (alias.includes(" ") && lower.includes(alias)) return state;
  }
  // Word-boundary check for single-word aliases
  for (const [alias, state] of Object.entries(STATE_ALIASES)) {
    if (alias.includes(" ")) continue;
    const re = new RegExp(`\\b${alias}\\b`);
    if (re.test(lower)) return state;
  }
  return "";
}