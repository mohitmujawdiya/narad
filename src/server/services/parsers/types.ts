export type ParsedTarget = {
  type: "company" | "job";
  companyName: string;
  companyDomain: string | null;
  jdUrl: string | null;
  pastedUrl: string | null;
  hint: string | null;
};

export type SourceFormat =
  | "yc-batch"
  | "wellfound-search"
  | "csv"
  | "url-list"
  | "single-url"
  | "jd-url";

export type DetectionResult = {
  format: SourceFormat;
  raw: string;
};

export type Parser = {
  format: SourceFormat;
  parse(raw: string): Promise<ParsedTarget[]> | ParsedTarget[];
};
