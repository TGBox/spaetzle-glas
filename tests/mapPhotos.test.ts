import { describe, expect, it } from "vitest";
import { mapPhotoCaption, mapPhotoUrl } from "../src/domain/mapPhotos";

describe("map photos", () => {
  it("accepts a plain path without caption", () => {
    expect(mapPhotoUrl("./photos/a.jpg")).toBe("./photos/a.jpg");
    expect(mapPhotoCaption("./photos/a.jpg")).toBeNull();
  });

  it("reads url and a trimmed caption from an object", () => {
    const photo = { url: "./photos/b.jpg", caption: "  Picknick am See " };
    expect(mapPhotoUrl(photo)).toBe("./photos/b.jpg");
    expect(mapPhotoCaption(photo)).toBe("Picknick am See");
  });

  it("treats an empty caption as none", () => {
    expect(mapPhotoCaption({ url: "./photos/c.jpg", caption: "   " })).toBeNull();
    expect(mapPhotoCaption({ url: "./photos/c.jpg" })).toBeNull();
  });
});
