import { isStableSlug, slugify } from "../src/lib/slug";

describe("slug generation", () => {
  test("normalizes diacritics and spaces", () => {
    expect(slugify("jalapeño")).toBe("jalapeno");
    expect(slugify("Xi Jinping")).toBe("xi-jinping");
    expect(slugify("Feng Shui")).toBe("feng-shui");
  });

  test("recognizes stable slugs", () => {
    expect(isStableSlug("qatar")).toBe(true);
    expect(isStableSlug("Xi Jinping")).toBe(false);
  });
});
