import type { DetectionResult } from "./types";

const JD_URL_PATTERNS = [
  /https?:\/\/(?:[^/]+\.)?greenhouse\.io\/[\w-]+\/jobs\/\d+/i,
  /https?:\/\/(?:jobs|boards)\.greenhouse\.io\/[\w-]+\/jobs\/\d+/i,
  /https?:\/\/jobs\.lever\.co\/[\w-]+\/[\w-]+/i,
  /https?:\/\/jobs\.ashbyhq\.com\/[\w-]+\/[\w-]+/i,
  /https?:\/\/[\w-]+\.myworkdayjobs\.com\/[\w-]+\/job\//i,
  /https?:\/\/(?:www\.)?linkedin\.com\/jobs\/view\/\d+/i,
  /https?:\/\/[\w.-]+\/jobs\/[\w-]+/i,
];

export function detectFormat(raw: string): DetectionResult {
  const trimmed = raw.trim();

  if (/ycombinator\.com\/companies/i.test(trimmed) && /batch=/i.test(trimmed)) {
    return { format: "yc-batch", raw: trimmed };
  }

  if (/wellfound\.com\/(jobs|companies|search)/i.test(trimmed)) {
    return { format: "wellfound-search", raw: trimmed };
  }

  // Single URL — JD-flavored first
  if (/^https?:\/\/\S+$/i.test(trimmed) && !trimmed.includes("\n")) {
    if (JD_URL_PATTERNS.some((re) => re.test(trimmed))) {
      return { format: "jd-url", raw: trimmed };
    }
    return { format: "single-url", raw: trimmed };
  }

  // CSV: header line with at least 2 columns
  const firstLine = trimmed.split("\n")[0] ?? "";
  if (firstLine.includes(",") && trimmed.includes("\n")) {
    return { format: "csv", raw: trimmed };
  }

  // URL list: every non-empty line is a URL
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((l) => /^https?:\/\/\S+$/i.test(l))) {
    return { format: "url-list", raw: trimmed };
  }

  return { format: "url-list", raw: trimmed };
}
