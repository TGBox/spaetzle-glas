import type { MapPhoto } from "../types/advent";

export function mapPhotoUrl(photo: MapPhoto): string {
  return typeof photo === "string" ? photo : photo.url;
}

/** The caption without surrounding blanks, or null when there is none. */
export function mapPhotoCaption(photo: MapPhoto): string | null {
  if (typeof photo === "string") {
    return null;
  }
  const caption = photo.caption?.trim() ?? "";
  return caption.length > 0 ? caption : null;
}
