export function parseLivestockDocument(rawText, knownBreeds = [], ocrConfidence = 0, states = []) {
  const text = normalizeOcrText(rawText);
  const lower = text.toLowerCase();
  const healthTerms = /(veterinary health certificate|sijil kesihatan veterinar|health status|veterinary officer|pegawai veterinar)/i;
  const birthTerms = /(birth certificate|sijil (?:kelahiran|lahir)|date of birth|tarikh lahir|\bsire\b|\bdam\b)/i;
  const documentType = healthTerms.test(text) ? "veterinary" : birthTerms.test(text) ? "birth" : "livestock_details";
  const speciesLabel = extractLabeledText(text, /species|spesies|jenis ternakan/i);
  const species = detectSpecies(speciesLabel) || detectSpecies(text);
  const breedLabel = extractLabeledText(text, /breed|baka/i);
  const matchingBreeds = [...knownBreeds]
    .filter((breed) => breed?.name)
    .sort((a, b) => b.name.length - a.name.length)
    .filter((breed) => (!species || !breed.species || breed.species.toLowerCase() === species.toLowerCase()));
  const matchedBreed = matchingBreeds.find((breed) => breedLabel.toLowerCase().includes(breed.name.toLowerCase()))
    || matchingBreeds.find((breed) => lower.includes(breed.name.toLowerCase()));

  const genderText = matchText(text, /(?:sex|gender|jantina)[ \t]*[:=\-]?[ \t]*(male|female|jantan|betina)\b/i);
  const gender = /^(female|betina)$/i.test(genderText) ? "Female" : /^(male|jantan)$/i.test(genderText) ? "Male" : "";
  const maleDirect = matchNumber(text, /(?:number of |bil(?:angan)?\.?[ \t]*)?(?:male|jantan)s?(?:[ \t]+count)?[ \t]*[:=\-]?[ \t]*(\d+)/i);
  const femaleDirect = matchNumber(text, /(?:number of |bil(?:angan)?\.?[ \t]*)?(?:female|betina)s?(?:[ \t]+count)?[ \t]*[:=\-]?[ \t]*(\d+)/i);
  const maleRows = (text.match(/(?:sex|gender|jantina)[ \t]*[:=\-]?[ \t]*(?:male|jantan)\b/gi) || []).length;
  const femaleRows = (text.match(/(?:sex|gender|jantina)[ \t]*[:=\-]?[ \t]*(?:female|betina)\b/gi) || []).length;
  const maleCount = maleDirect || maleRows || (gender === "Male" ? 1 : 0);
  const femaleCount = femaleDirect || femaleRows || (gender === "Female" ? 1 : 0);

  const certificateCandidate = extractLabeledText(text, /(?:certificate|cert(?:ificate)?|sijil)[ \t]*(?:no\.?|number|nombor|#|id)/i, true)
    || extractLabeledText(text, /certificate|sijil/i);
  const animalIdCandidate = extractLabeledText(text, /(?:(?:animal|livestock)[ \t]+(?:id|no\.?|number|nombor|#)(?:[ \t]*\/[ \t]*tag)?|(?:ear[ \t]*tag|tag)(?:[ \t]+(?:id|no\.?|number|nombor|#))?)/i, true);
  const certificateNumber = cleanIdentifier(certificateCandidate);
  const animalId = cleanIdentifier(animalIdCandidate);
  const birthDateRaw = matchText(text, /(?:date of birth|birth date|tarikh lahir|dob)[ \t]*[:=\-]?[ \t]*([0-9]{1,4}[/\.\-][0-9]{1,2}[/\.\-][0-9]{1,4})/i);
  const birthDate = normalizeDate(birthDateRaw);
  const veterinaryOfficer = cleanPersonName(extractLabeledText(text, /veterinary officer|veterinarian|pegawai veterinar|veterinary surgeon/i, true));
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
  if (certificateCandidate && !certificateNumber) warnings.push("invalid_certificate_number");
  if (animalIdCandidate && !animalId) warnings.push("invalid_animal_id");
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
  const detectedGroups = [...groups.values()];
  const speciesValues = [...new Set(detectedGroups.map((group) => group.species).filter(Boolean))];
  const documentTypes = [...new Set(unique.map((result) => result.documentType).filter(Boolean))];
  const conflicts = [];
  const consistentValue = (key) => {
    const values = [...new Set(unique.map((result) => result[key]).filter(Boolean))];
    if (values.length > 1) conflicts.push(key);
    return values.length === 1 ? values[0] : "";
  };
  const consistent = Object.fromEntries([
    "certificateNumber",
    "animalId",
    "gender",
    "birthDate",
    "state",
    "veterinaryOfficer",
    "color",
    "weight",
  ].map((key) => [key, consistentValue(key)]));
  const documentType = documentTypes.length === 1 ? documentTypes[0] : "mixed";
  const warnings = [...new Set(unique.flatMap((result) => result.warnings || []))];
  if (!groups.size) warnings.push("no_bulk_groups");
  if (duplicateCount) warnings.push("duplicate_documents");
  if (speciesValues.length > 1) warnings.push("mixed_species");
  if (conflicts.length) warnings.push("conflicting_fields");
  const blockingWarnings = warnings.filter((warning) => ["no_bulk_groups", "mixed_species"].includes(warning));
  const maleCount = detectedGroups.reduce((sum, group) => sum + Number(group.maleCount || 0), 0);
  const femaleCount = detectedGroups.reduce((sum, group) => sum + Number(group.femaleCount || 0), 0);
  const baseConfidence = Math.round(average(unique.map((result) => result.confidence)));
  const confidencePenalty = (speciesValues.length > 1 ? 20 : 0) + Math.min(15, conflicts.length * 3);

  return {
    documentCount: unique.length,
    duplicateCount,
    rawText: unique.map((result) => result.rawText).join("\n\n--- PAGE ---\n\n"),
    documentType,
    certificateNumber: consistent.certificateNumber,
    animalId: consistent.animalId,
    species: speciesValues.length === 1 ? speciesValues[0] : "",
    breed: detectedGroups.length === 1 ? detectedGroups[0].breed : "",
    breedId: detectedGroups.length === 1 ? detectedGroups[0].breedId : "",
    gender: consistent.gender,
    maleCount,
    femaleCount,
    birthDate: consistent.birthDate,
    state: consistent.state,
    veterinaryOfficer: consistent.veterinaryOfficer,
    color: consistent.color,
    weight: consistent.weight,
    confidence: Math.max(0, baseConfidence - confidencePenalty),
    detectedFieldCount: unique.reduce((sum, result) => sum + result.detectedFieldCount, 0),
    warnings: [...new Set(warnings)],
    blockingWarnings,
    conflicts,
    groups: detectedGroups,
    documents: unique.map((result) => ({
      filename: result.filename || "",
      documentType: result.documentType,
      species: result.species,
      breed: result.breed,
      maleCount: Number(result.maleCount || 0),
      femaleCount: Number(result.femaleCount || 0),
      confidence: result.confidence,
      warnings: result.warnings || [],
    })),
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

function detectSpecies(value) {
  const source = String(value || "");
  const goat = /\b(goat|kambing|caprine)\b/i.test(source);
  const cow = /\b(cow|cattle|lembu|bovine)\b/i.test(source);
  if (goat === cow) return "";
  return goat ? "Goat" : "Cow";
}

function extractLabeledText(text, labelPattern, allowNextLine = false) {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const pattern = new RegExp(`^(?:${labelPattern.source})\\s*(?:[:=\\-]\\s*)?(.*)$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (!match) continue;
    const sameLine = String(match[1] || "").trim();
    if (sameLine) return sameLine;
    if (allowNextLine && lines[index + 1] && !looksLikeLabel(lines[index + 1])) return lines[index + 1];
  }
  return "";
}

function looksLikeLabel(value) {
  return /^(?:certificate|animal|livestock|species|spesies|breed|baka|male|female|jantan|betina|state|negeri|date|tarikh|veterinary|pegawai|total|information|details?)\b/i.test(String(value || "").trim());
}

function cleanIdentifier(value) {
  const candidate = String(value || "").toUpperCase().match(/[A-Z0-9][A-Z0-9/\-]{2,39}/)?.[0] || "";
  if (!candidate || !/\d/.test(candidate)) return "";
  if (/^(?:INFORMATION|TOTAL|DETAILS?|NUMBER|NOMBOR|UNKNOWN|CERTIFICATE|ANIMAL|LIVESTOCK)$/.test(candidate)) return "";
  return candidate;
}

function cleanPersonName(value) {
  const candidate = String(value || "").trim().replace(/\s{2,}/g, " ");
  if (!candidate || candidate.length > 60 || looksLikeLabel(candidate)) return "";
  if (!/[A-Za-z]{2}/.test(candidate) || /^(?:not detected|unknown|n\/a)$/i.test(candidate)) return "";
  return candidate;
}

function matchText(text, pattern) { return String(text.match(pattern)?.[1] || "").trim().replace(/[|]+$/, ""); }
function matchNumber(text, pattern) { const value = Number(text.match(pattern)?.[1] || 0); return Number.isFinite(value) ? value : 0; }
function average(values) { return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0; }
