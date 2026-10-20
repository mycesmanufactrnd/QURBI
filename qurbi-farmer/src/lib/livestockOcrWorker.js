import { BREEDS_BY_SPECIES } from "@/lib/agri";

export const OCR_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const OCR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "application/x-pdf"]);

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
    if ((!OCR_ALLOWED_TYPES.has(file.type) && !isPdfFile(file)) || file.size > OCR_MAX_FILE_BYTES) {
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

export async function recognizeLivestockFiles(files, onProgress, { maxPages = 10 } = {}) {
  const inputs = await expandOcrInputs(files, maxPages);
  const requiresOcr = inputs.some((input) => !input.text);
  let worker;
  let activeFile = 0;
  let stageStart = 0;
  let stageSpan = 1;
  try {
    const logger = (message) => {
      if (message.status === "recognizing text") {
        const fileProgress = stageStart + message.progress * stageSpan;
        onProgress?.(Math.round(((activeFile + fileProgress) / inputs.length) * 100));
      }
    };
    if (requiresOcr) {
      const { createWorker } = await import("tesseract.js");
      try {
        worker = await createWorker(["eng", "msa"], 1, { logger });
      } catch {
        await worker?.terminate().catch(() => null);
        worker = await createWorker("eng", 1, {
          logger,
        });
      }
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: /** @type {any} */ ("3"),
      });
    }
    const results = [];
    for (let index = 0; index < inputs.length; index += 1) {
      activeFile = index;
      const input = inputs[index];
      if (input.text) {
        results.push({ text: input.text, confidence: 99, filename: input.filename });
        onProgress?.(Math.round(((index + 1) / inputs.length) * 100));
        continue;
      }

      stageStart = 0;
      stageSpan = 0.6;
      await worker.setParameters({ tessedit_pageseg_mode: /** @type {any} */ ("3") });
      const original = await worker.recognize(input.source);
      let selected = original.data;

      if (shouldTryEnhanced(original.data)) {
        const enhanced = await enhanceDocumentImage(input.source).catch(() => null);
        if (enhanced) {
          try {
            stageStart = 0.6;
            stageSpan = 0.4;
            await worker.setParameters({ tessedit_pageseg_mode: /** @type {any} */ ("6") });
            const enhancedResult = await worker.recognize(enhanced);
            if (ocrQuality(enhancedResult.data) > ocrQuality(original.data)) {
              selected = enhancedResult.data;
            }
          } catch {
            selected = original.data;
          }
        }
      }

      results.push({
        text: selected.text || "",
        confidence: Number(selected.confidence || 0),
        filename: input.filename,
      });
      onProgress?.(Math.round(((index + 1) / inputs.length) * 100));
    }
    return results;
  } finally {
    await worker?.terminate().catch(() => null);
  }
}

async function expandOcrInputs(files, maxPages) {
  const inputs = [];
  for (const file of files) {
    if (!isPdfFile(file)) {
      inputs.push({ source: file, filename: file.name, text: "" });
      if (inputs.length > maxPages) throw pdfError("OCR_PAGE_LIMIT");
      continue;
    }

    const pdfPages = await readPdfPages(file);
    if (inputs.length + pdfPages.length > maxPages) throw pdfError("OCR_PAGE_LIMIT");
    inputs.push(...pdfPages);
  }
  return inputs;
}

async function readPdfPages(file) {
  try {
    const [pdfjs, workerModule] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const filename = `${file.name} - page ${pageNumber}`;
        const text = await extractPdfPageText(page);
        if (hasUsefulDocumentText(text)) {
          pages.push({ source: null, filename, text });
        } else {
          pages.push({ source: await renderPdfPage(page), filename, text: "" });
        }
        page.cleanup();
      }
    } finally {
      await loadingTask.destroy();
    }
    return pages;
  } catch (error) {
    if (error?.code === "OCR_PAGE_LIMIT") throw error;
    throw pdfError("OCR_PDF_READ_FAILED");
  }
}

async function extractPdfPageText(page) {
  const content = await page.getTextContent();
  return content.items
    .map((item) => `${String(item.str || "")}${item.hasEOL ? "\n" : " "}`)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function hasUsefulDocumentText(text) {
  const meaningfulCharacters = (String(text || "").match(/[A-Za-z0-9]/g) || []).length;
  return meaningfulCharacters >= 80 || countKnownLabels(text) >= 2;
}

async function renderPdfPage(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const maxDimension = 2200;
  const scale = Math.min(2, maxDimension / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale: Math.max(1, scale) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is unavailable");
  await page.render({ canvasContext: context, viewport }).promise;
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PDF page rendering failed")), "image/png");
  });
}

function pdfError(code) {
  const error = /** @type {Error & { code?: string }} */ (new Error(code));
  error.code = code;
  return error;
}

function shouldTryEnhanced(result) {
  const text = String(result?.text || "");
  return Number(result?.confidence || 0) < 78 || countKnownLabels(text) < 3;
}

function ocrQuality(result) {
  const text = String(result?.text || "");
  const meaningfulCharacters = (text.match(/[A-Za-z0-9]/g) || []).length;
  return Number(result?.confidence || 0) + countKnownLabels(text) * 8 + Math.min(12, meaningfulCharacters / 30);
}

function countKnownLabels(text) {
  const matches = String(text || "").match(/\b(?:species|spesies|jenis ternakan|gender|jantina|breed|baka|colou?r|warna|state|negeri|age|umur|description|penerangan|catatan|weight|berat|certificate|sijil)\b/gi) || [];
  return new Set(matches.map((value) => value.toLowerCase())).size;
}

async function enhanceDocumentImage(file) {
  const source = await loadImageSource(file);
  try {
    const maxDimension = 2200;
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(source.image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    applyAdaptiveThreshold(imageData, width, height);
    context.putImageData(imageData, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image enhancement failed")), "image/png");
    });
  } finally {
    source.close?.();
  }
}

function applyAdaptiveThreshold(imageData, width, height) {
  const pixels = imageData.data;
  const grayscale = new Uint8Array(width * height);
  const integral = new Uint32Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      const gray = Math.round(pixels[pixelIndex] * 0.299 + pixels[pixelIndex + 1] * 0.587 + pixels[pixelIndex + 2] * 0.114);
      grayscale[index] = gray;
      rowSum += gray;
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum;
    }
  }

  const radius = Math.max(12, Math.round(Math.min(width, height) / 70));
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const sum = integral[(bottom + 1) * (width + 1) + right + 1]
        - integral[top * (width + 1) + right + 1]
        - integral[(bottom + 1) * (width + 1) + left]
        + integral[top * (width + 1) + left];
      const index = y * width + x;
      const output = grayscale[index] < (sum / area) - 16 ? 0 : 255;
      const pixelIndex = index * 4;
      pixels[pixelIndex] = output;
      pixels[pixelIndex + 1] = output;
      pixels[pixelIndex + 2] = output;
      pixels[pixelIndex + 3] = 255;
    }
  }
}

async function loadImageSource(file) {
  if (typeof globalThis.createImageBitmap === "function") {
    const bitmap = await globalThis.createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image could not be decoded"));
      element.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isPdfFile(file) {
  return /pdf/i.test(String(file?.type || "")) || /\.pdf$/i.test(String(file?.name || ""));
}
