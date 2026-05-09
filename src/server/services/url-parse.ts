export type ParsedCompanyUrl = {
  url: string;
  domain: string;
  inferredName: string;
};

export function parseCompanyUrl(input: string): ParsedCompanyUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const domain = url.hostname.replace(/^www\./, "");
  const inferredName = domain
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return { url: url.toString(), domain, inferredName };
}
