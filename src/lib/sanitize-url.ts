const SAFE_URL_PATTERN = /^https?:\/\//i;

export function isSafeUrl(url: string): boolean {
  return SAFE_URL_PATTERN.test(url.trim());
}

export function sanitizeUrl(url: string): string | undefined {
  return isSafeUrl(url) ? url.trim() : undefined;
}
