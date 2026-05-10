import { describe, it, expect } from "vitest";
import { detectFormat } from "@/server/services/parsers/format-detector";

describe("detectFormat", () => {
  it("detects YC batch URLs", () => {
    expect(
      detectFormat(
        "https://www.ycombinator.com/companies?batch=W24&industry=AI",
      ).format,
    ).toBe("yc-batch");
  });

  it("detects Wellfound search URLs", () => {
    expect(detectFormat("https://wellfound.com/jobs?role=engineer").format).toBe(
      "wellfound-search",
    );
    expect(detectFormat("https://wellfound.com/companies").format).toBe(
      "wellfound-search",
    );
  });

  it("detects 2-row CSV bodies", () => {
    const csv = "companyName,domain\nAcme,acme.com\nWidgets,widgets.io";
    expect(detectFormat(csv).format).toBe("csv");
  });

  it("detects multi-line URL lists", () => {
    const list = [
      "https://anthropic.com",
      "https://openai.com",
      "https://stripe.com",
    ].join("\n");
    expect(detectFormat(list).format).toBe("url-list");
  });

  it("classifies a Greenhouse JD URL as jd-url", () => {
    expect(
      detectFormat("https://boards.greenhouse.io/anthropic/jobs/4567890").format,
    ).toBe("jd-url");
  });

  it("classifies a Lever JD URL as jd-url", () => {
    expect(
      detectFormat("https://jobs.lever.co/openai/abcd-1234-eng").format,
    ).toBe("jd-url");
  });

  it("classifies an Ashby JD URL as jd-url", () => {
    expect(
      detectFormat("https://jobs.ashbyhq.com/linear/swe-intern").format,
    ).toBe("jd-url");
  });

  it("classifies a LinkedIn jobs URL as jd-url", () => {
    expect(
      detectFormat("https://www.linkedin.com/jobs/view/3845671234").format,
    ).toBe("jd-url");
  });

  it("classifies a Workday JD URL as jd-url", () => {
    expect(
      detectFormat(
        "https://nvidia.myworkdayjobs.com/External/job/SantaClara",
      ).format,
    ).toBe("jd-url");
  });

  it("classifies a generic homepage URL as single-url", () => {
    expect(detectFormat("https://anthropic.com").format).toBe("single-url");
  });
});
