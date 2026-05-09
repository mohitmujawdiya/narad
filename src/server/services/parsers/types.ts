/**
 * Parser interface: each implementation takes a string (whatever the user
 * pasted) and returns a normalized list of company candidates. No DB access.
 */

export type ParsedTarget = {
  name: string;
  domain: string | null;
  sourceUrl: string | null;
  sector: string | null;
  stage: string | null;
  /** Free-form note from the source (e.g., "YC W26 batch"). */
  hint: string | null;
};

export type ParseResult =
  | { kind: "ok"; format: ParserFormat; targets: ParsedTarget[] }
  | { kind: "empty"; format: ParserFormat | null }
  | { kind: "error"; format: ParserFormat | null; message: string };

export type ParserFormat = "yc-batch" | "wellfound" | "csv" | "url-list" | "single-url";

export interface SourceParser {
  readonly format: ParserFormat;
  /** Heuristic — is this input something this parser claims? */
  matches(input: string): boolean;
  /** Parse input into normalized targets. May throw on truly malformed input. */
  parse(input: string): Promise<ParsedTarget[]>;
}
