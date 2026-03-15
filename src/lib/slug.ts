const MULTI_DASH = /-+/g;
const LEADING_TRAILING_DASH = /^-|-$/g;

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(MULTI_DASH, "-")
    .replace(LEADING_TRAILING_DASH, "");
}

export function isStableSlug(value: string): boolean {
  return slugify(value) === value && value.length >= 2;
}
