import { describe, it, expect } from "vitest";
import { csvParser } from "@/server/services/parsers/csv";
import { urlListParser } from "@/server/services/parsers/url-list";
import { singleUrlParser } from "@/server/services/parsers/single-url";

describe("csvParser", () => {
  it("parses CSV with name + domain headers", async () => {
    const input = `name,domain,sector,stage
Stripe,stripe.com,fintech,public
Lithic,lithic.com,fintech,series-c`;
    const out = await csvParser.parse(input);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({
      name: "Stripe",
      domain: "stripe.com",
      sourceUrl: null,
      sector: "fintech",
      stage: "public",
      hint: null,
    });
  });

  it("infers domain from first column when only name given", async () => {
    const input = `name
Stripe
Lithic`;
    const out = await csvParser.parse(input);
    expect(out[0].name).toBe("Stripe");
    expect(out[0].domain).toBeNull();
  });

  it("matches() returns true for header rows containing 'name' or 'domain'", () => {
    expect(csvParser.matches("name,domain\nStripe,stripe.com")).toBe(true);
    expect(csvParser.matches("foo,bar")).toBe(false);
  });
});

describe("urlListParser", () => {
  it("parses one URL per line", async () => {
    const input = `https://stripe.com\nlithic.com\nhttps://wellfound.com/companies/example`;
    const out = await urlListParser.parse(input);
    expect(out.length).toBe(3);
    expect(out[0].domain).toBe("stripe.com");
    expect(out[1].domain).toBe("lithic.com");
  });

  it("matches() requires multiple lines, all URL-shaped", () => {
    expect(urlListParser.matches("https://a.com\nhttps://b.com")).toBe(true);
    expect(urlListParser.matches("https://a.com")).toBe(false); // single URL
    expect(urlListParser.matches("hello world")).toBe(false);
  });
});

describe("singleUrlParser", () => {
  it("parses one company from one URL", async () => {
    const out = await singleUrlParser.parse("stripe.com");
    expect(out.length).toBe(1);
    expect(out[0].domain).toBe("stripe.com");
  });

  it("matches() requires exactly one URL-shaped line", () => {
    expect(singleUrlParser.matches("stripe.com")).toBe(true);
    expect(singleUrlParser.matches("https://stripe.com")).toBe(true);
    expect(singleUrlParser.matches("a\nb")).toBe(false);
  });
});
