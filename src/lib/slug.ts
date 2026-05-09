const RESERVED_SLUGS = new Set([
  "api",
  "sign-in",
  "sign-up",
  "admin",
  "_next",
  "favicon",
  "robots",
  "sitemap",
]);

/**
 * Generate a URL-safe slug from a project name.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens,
 * collapses consecutive hyphens, trims hyphens, and caps at 60 chars.
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return base || "project";
}

/**
 * Ensure a slug is unique among existing slugs.
 * Appends -2, -3, etc. for collisions. Also rejects reserved paths.
 */
export function ensureUniqueSlug(
  base: string,
  existingSlugs: Set<string>
): string {
  let candidate = base;

  // If the base itself is reserved, start with -1
  if (RESERVED_SLUGS.has(candidate)) {
    candidate = `${base}-1`;
  }

  if (!existingSlugs.has(candidate)) return candidate;

  let counter = 2;
  while (existingSlugs.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/** Check if a string looks like a CUID (for backward-compat routing). */
export function isCuid(value: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(value);
}
