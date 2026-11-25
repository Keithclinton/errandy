import { apiFetch } from "./api-client";
import { compressPhoto, PhotoSize } from "./compress-photo";

/** Thrown when the browser can't read the chosen file as a photo. */
export class UnreadablePhotoError extends Error {
  constructor() {
    super("We couldn't read that photo. Try again with a JPG or PNG.");
    this.name = "UnreadablePhotoError";
  }
}

/**
 * Shrinks a photo on the device, then uploads it. Resolves to its address, which only sticks
 * once the listing or profile is saved with it (unused photos are deleted after a day).
 */
export async function uploadPhoto(file: File, size: PhotoSize): Promise<string> {
  let photo: string;
  try {
    photo = await compressPhoto(file, size);
  } catch {
    throw new UnreadablePhotoError();
  }
  const { url } = await apiFetch<{ url: string }>("/photos", { method: "POST", body: { photo } });
  return url;
}
