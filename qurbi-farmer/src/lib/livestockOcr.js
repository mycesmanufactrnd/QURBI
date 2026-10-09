export function parseLivestockDocument(rawText, knownBreeds = [], ocrConfidence = 0, states = []) {
  const text = normalizeOcrText(rawText);
  const lower = text.toLowerCase();
  const healthTerms = /(veterinary health certificate|sijil kesihatan veterinar|health status|veterinary officer|pegawai veterinar)/i;
  const birthTerms = /(birth certificate|sijil (?:kelahiran|lahir)|date of birth|tarikh lahir|\bsire\b|\bdam\b)/i;
  const documentType = healthTerms.test(text) ? "veterinary" : birthTerms.test(text) ? "birth" : "livestock_details";
  const species = /\b(goat|kambing|caprine)\b/i.test(text) ? "Goat" : /\b(cow|cattle|lembu|bovine)\b/i.test(text) ? "Cow" : "";
  const matchedBreed = [...knownBreeds]
    .filter((breed) => breed?.name)
    .sort((a, b) => b.name.length - a.name.length)
    .find((breed) => lower.includes(breed.name.toLowerCase()) && (!species || !breed.species || breed.species.toLowerCase() === species.toLowerCase()));

  const genderText = matchText(text, /(?:sex|gender|jantina)[ \t]*[:=\-]?[ \t]*(male|female|jantan|betina)\b/i);
  const gender = /^(female|betina)$/i.test(genderText) ? "Female" : /^(male|jantan)$/i.test(genderText) ? "Male" : "";
  const maleDirect = matchNumber(text, /(?:number of |bil(?:angan)?\.?[ \t]*)?(?:male|jantan)s?[ \t]*[:=\-]?[ \t]*(\d+)/i);
  const femaleDirect = matchNumber(text, /(?:number of |bil(?:angan)?\.?[ \t]*)?(?:female|betina)s?[ \t]*[:=\-]?[ \t]*(\d+)/i);
  const maleRows = (text.match(/(?:sex|gender|jantina)[ \t]*[:=\-]?[ \t]*(?:male|jantan)\b/gi) || []).length;
  const femaleRows = (text.match(/(?:sex|gender|jantina)[ \t]*[:=\-]?[ \t]*(?:female|betina)\b/gi) || []).length;
  const maleCount = maleDirect || maleRows || (gender === "Male" ? 1 : 0);
  const femaleCount = femaleDirect || femaleRows || (gender === "Female" ? 1 : 0);

  const certificateNumber = matchText(text, /(?:^|\n)[ \t]*(?:certificate|cert(?:ificate)?|sijil)[ \t]*(?:no|number|nombor|#)?[ \t]*[:=\-]?[ \t]*([A-Z0-9][A-Z0-9/\-]{3,})/im);
  const animalId = matchText(text, /(?:^|\n)[ \t]*(?:(?:animal|livestock)[ \t]+(?:id|no|number|nombor|#)|(?:ear[ \t]*tag|tag)(?:[ \t]+(?:id|no|number|nombor|#))?)[ \t]*[:=\-]?[ \t]*([A-Z0-9][A-Z0-9/\-]{2,})/im);
  const birthDateRaw = matchText(text, /(?:date of birth|birth date|tarikh lahir|dob)[ \t]*[:=\-]?[ \t]*([0-9]{1,4}[/\.\-][0-9]{1,2}[/\.\-][0-9]{1,4})/i);
  const birthDate = normalizeDate(birthDateRaw);
  const veterinaryOfficer = matchText(text, /(?:veterinary officer|veterinarian|pegawai veterinar|veterinary surgeon)[ \t]*[:=\-]?[ \t]*([^\n]{3,60})/i);
  const color = matchText(text, /(?:colou?r|warna)[ \t]*[:=\-]?[ \t]*([^\n]{2,50})/i);
  const weight = matchText(text, /(?:birth[ \t]+weight|weight|berat)[ \t]*[:=\-]?[ \t]*([0-9]+(?:\.[0-9]+)?)[ \t]*(?:kg|kilogram)?/i);
  const state = [...states].sort((a, b) => String(b).length - String(a).length).find((name) => lower.includes(String(name).toLowerCase())) || "";

  const detectedValues = [species, matchedBreed?.name, gender, maleCount || femaleCount, certificateNumber, animalId, birthDate, state, veterinaryOfficer, color, weight];
  const detectedFieldCount = detectedValues.filter(Boolean).length;
  const confidence = Math.round(Math.max(0, Math.min(100, Number(ocrConfidence || 0) * 0.7 + Math.min(30, detectedFieldCount * 3))));
  const warnings = [];
  if (!text.trim()) warnings.push("empty_text");
  if (!species) warnings.push("species_missing");
  if (!matchedBreed?.name) warnings.push("breed_missing");
  if (confidence < 60) warnings.push("low_confidence");

  return {
    rawText: text,
    documentType,
    certificateNumber,
    animalId,
    species: species || matchedBreed?.species || "",
    breed: matchedBreed?.name || "",
    breedId: matchedBreed?.id || "",
    gender,
    maleCount,
    femaleCount,
    birthDate,
    state,
    veterinaryOfficer,
    color,
    weight,
    confidence,
    detectedFieldCount,
    warnings,
  };
}

export function combineLivestockDocuments(results) {
  const { unique, duplicateCount } = uniqueResults(results);
  const groups = new Map();
  unique.forEach((result) => {
    const count = Number(result.maleCount || 0) + Number(result.femaleCount || 0);
    if (!result.species || !result.breed || !count) return;
    const key = `${result.species}:${result.breed}`;
    const current = groups.get(key) || { species: result.species, breed: result.breed, breedId: result.breedId || "", maleCount: 0, femaleCount: 0 };
    current.maleCount += Number(result.maleCount || 0);
    current.femaleCount += Number(result.femaleCount || 0);
    if (!current.breedId && result.breedId) current.breedId = result.breedId;
    groups.set(key, current);
  });
  const firstValue = (key) => unique.find((result) => result[key])?.[key] || "";
  const documentType = unique.some((result) => result.documentType === "veterinary") ? "veterinary" : unique.some((result) => result.documentType === "birth") ? "birth" : "livestock_details";
  const warnings = [...new Set(unique.flatMap((result) => result.warnings || []))];
  if (!groups.size) warnings.push("no_bulk_groups");
  if (duplicateCount) warnings.push("duplicate_documents");

  return {
    documentCount: unique.length,
    duplicateCount,
    rawText: unique.map((result) => result.rawText).join("\n\n--- PAGE ---\n\n"),
    documentType,
    certificateNumber: firstValue("certificateNumber"),
    animalId: firstValue("animalId"),
    species: firstValue("species"),
    breed: firstValue("breed"),
    breedId: firstValue("breedId"),
    gender: firstValue("gender"),
    maleCount: unique.reduce((sum, result) => sum + Number(result.maleCount || 0), 0),
    femaleCount: unique.reduce((sum, result) => sum + Number(result.femaleCount || 0), 0),
    birthDate: firstValue("birthDate"),
    state: firstValue("state"),
    veterinaryOfficer: firstValue("veterinaryOfficer"),
    color: firstValue("color"),
    weight: firstValue("weight"),
    confidence: Math.round(average(unique.map((result) => result.confidence))),
    detectedFieldCount: unique.reduce((sum, result) => sum + result.detectedFieldCount, 0),
    warnings: [...new Set(warnings)],
    groups: [...groups.values()],
  };
}

export function combineIndividualDocuments(results) {
  const { unique, duplicateCount } = uniqueResults(results);
  const ranked = [...unique].sort((a, b) => (b.detectedFieldCount - a.detectedFieldCount) || (b.confidence - a.confidence));
  const keys = ["certificateNumber", "animalId", "species", "breed", "breedId", "gender", "birthDate", "state", "veterinaryOfficer", "color", "weight"];
  const combined = {};
  const conflicts = [];
  keys.forEach((key) => {
    const values = [...new Set(ranked.map((result) => result[key]).filter(Boolean))];
    combined[key] = values[0] || "";
    if (values.length > 1) conflicts.push(key);
  });
  const warnings = [...new Set(unique.flatMap((result) => result.warnings || []))];
  if (duplicateCount) warnings.push("duplicate_documents");
  if (conflicts.length) warnings.push("conflicting_fields");

  return {
    ...combined,
    documentType: ranked[0]?.documentType || "livestock_details",
    documentCount: unique.length,
    duplicateCount,
    conflicts,
    warnings,
    confidence: Math.round(average(unique.map((result) => result.confidence))),
    detectedFieldCount: keys.filter((key) => combined[key]).length,
    rawText: unique.map((result) => result.rawText).join("\n\n--- PAGE ---\n\n"),
  };
}

function uniqueResults(results) {
  const seen = new Set();
  const unique = [];
  let duplicateCount = 0;
  results.forEach((result) => {
    const fingerprint = String(result.rawText || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (fingerprint && seen.has(fingerprint)) {
      duplicateCount += 1;
      return;
    }
    if (fingerprint) seen.add(fingerprint);
    unique.push(result);
  });
  return { unique, duplicateCount };
}

function normalizeOcrText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[|¦]/g, "I")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDate(value) {
  const match = String(value || "").match(/^(\d{1,4})[/\.\-](\d{1,2})[/\.\-](\d{1,4})$/);
  if (!match) return "";
  let [, first, middle, last] = match;
  let year;
  let month;
  let day;
  if (first.length === 4) {
    [year, month, day] = [first, middle, last];
  } else {
    [day, month, year] = [first, middle, last];
  }
  if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`;
  const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function matchText(text, pattern) { return String(text.match(pattern)?.[1] || "").trim().replace(/[|]+$/, ""); }
function matchNumber(text, pattern) { const value = Number(text.match(pattern)?.[1] || 0); return Number.isFinite(value) ? value : 0; }
function average(values) { return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0; }
