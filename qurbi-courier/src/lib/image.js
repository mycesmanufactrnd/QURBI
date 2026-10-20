// The upload endpoint caps images at 5 MB, and a modern phone photo is often
// bigger than that. Shrinking on the phone keeps document uploads from failing
// for a reason the courier cannot see or fix.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Longest side after shrinking: sharp enough to read an IC, small enough to upload on 4G. */
export const MAX_DIMENSION = 2000;

/** Pure sizing maths, split out so it can be tested without a canvas. */
export function fitWithin(width, height, maxDimension = MAX_DIMENSION) {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height, scaled: false };
  const ratio = maxDimension / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio), scaled: true };
}

/**
 * Returns a JPEG no larger than the upload limit. Files that are already small
 * enough and are JPEG/PNG/WebP are returned untouched.
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export async function prepareImageForUpload(file) {
  if (file.size <= MAX_UPLOAD_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error("image-too-large");
  } finally {
    bitmap.close?.();
  }
}
