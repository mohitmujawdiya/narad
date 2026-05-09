import { describe, it, expect } from "vitest";
import { detectFormat } from "@/server/services/parsers/format-detector";

describe("detectFormat", () => {
  it("detects YC batch URL", () => {
    expect(detectFormat("https://www.ycombinator.com/companies?batch=W26")).toBe("yc-batch");
  });
  it("detects Wellfound URL", () => {
    expect(detectFormat("https://wellfound.com/discover")).toBe("wellfound");
  });
  it("detects CSV with header", () => {
    expect(detectFormat("name,domain\nStripe,stripe.com")).toBe("csv");
  });
  it("detects URL list (multi-line URLs)", () => {
    expect(detectFormat("stripe.com\nlithic.com\nbrex.com")).toBe("url-list");
  });
  it("detects single URL", () => {
    expect(detectFormat("stripe.com")).toBe("single-url");
  });
  it("returns null for arbitrary text", () => {
    expect(detectFormat("hello world this is not a list")).toBeNull();
  });
});
