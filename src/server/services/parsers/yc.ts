// YC batch parser not implemented in redesign-v2 — placeholder so format detection succeeds.
import type { ParsedTarget, Parser } from "./types";

export const ycParser: Parser = {
  format: "yc-batch",
  parse(_raw: string): ParsedTarget[] {
    return [];
  },
};
