import { BREEDS_BY_SPECIES } from "@/lib/agri";

export const OCR_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const OCR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function buildKnownBreeds(managedBreeds = []) {
  const defaults = Object.entries(BREEDS_BY_SPECIES).flatMap(([species, names]) => names
    .filter((name) => name !== "Unspecified")
    .map((name) => ({ name, species, id: "" })));
  const managed = managedBreeds.map((breed) => ({
    name: String(breed.name || breed.label || "").trim(),
    species: String(breed.species?.name || breed.species || "").trim(),
    id: breed.id || "",
  })).filter((breed) => breed.name);
  const byKey = new Map();
  [...defaults, ...managed].forEach((breed) => {
    const key = `${breed.species.toLowerCase()}:${breed.name.toLowerCase()}`;
    const current = byKey.get(key);
    byKey.set(key, current?.id ? current : breed);
  });
  return [...byKey.values()];
}

export function addUniqueOcrFiles(currentFiles, selectedFiles, maxFiles) {
  const current = [...currentFiles];
  const existing = new Set(current.map(fileKey));
  let duplicateCount = 0;
  let invalidCount = 0;
  Array.from(selectedFiles || []).forEach((file) => {
    if (!OCR_ALLOWED_TYPES.has(file.type) || file.size > OCR_MAX_FILE_BYTES) {
      invalidCount += 1;
      return;
    }
    const key = fileKey(file);
    if (existing.has(key)) {
      duplicateCount += 1;
      return;
    }
    if (current.length < maxFiles) {
      current.push(file);
      existing.add(key);
    }
  });
  return { files: current, duplicateCount, invalidCount };
}

export async function recognizeLivestockFiles(files, onProgress) {
  const { createWorker } = await import("tesseract.js");
  let worker;
  let activeFile = 0;
  try {
    worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          onProgress?.(Math.round(((activeFile + message.progress) / files.length) * 100));
        }
      },
    });
    const results = [];
    for (let index = 0; index < files.length; index += 1) {
      activeFile = index;
      const response = await worker.recognize(files[index]);
      results.push({ text: response.data.text || "", confidence: Number(response.data.confidence || 0), filename: files[index].name });
    }
    onProgress?.(100);
    return results;
  } finally {
    await worker?.terminate().catch(() => null);
  }
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
