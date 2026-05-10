// Wellfound search parser not implemented in redesign-v2 — placeholder so format detection succeeds.
import type { ParsedTarget, Parser } from "./types";

export const wellfoundParser: Parser = {
  format: "wellfound-search",
  parse(_raw: string): ParsedTarget[] {
    return [];
  },
};
