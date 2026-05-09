import { webResearch } from "./ai/web-research";
import { extractJdSystemPrompt, extractJdUserPrompt } from "./ai/prompts/extract-jd";

export type ExtractedJD = {
  title: string;
  companyName: string;
  companyDomain: string | null;
  location: string | null;
  comp: string | null;
  deadline: string | null;
  requirementsParsed: string[];
  jdMarkdown: string;
};

/**
 * Extract structured JD data from a posted job-description URL using
 * OpenAI Responses + web_search. Returns null when the LLM signals it
 * could not access the URL, the response is unparseable, or the network
 * call fails.
 */
export async function extractJd(url: string): Promise<ExtractedJD | null> {
  let result;
  try {
    result = await webResearch({
      prompt: extractJdUserPrompt(url),
      system: extractJdSystemPrompt(),
    });
  } catch {
    return null;
  }
  const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.error) return null;
    return parsed as ExtractedJD;
  } catch {
    return null;
  }
}
