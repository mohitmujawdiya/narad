import { describe, it, expect } from "vitest";
import { csvParser } from "@/server/services/parsers/csv";

describe("csvParser", () => {
  it("parses a 2-row CSV with mixed company + JD columns", () => {
    const raw = [
      "companyName,domain,jdUrl,hint",
      "Acme,acme.com,,founder lead",
      "Widgets,widgets.io,https://boards.greenhouse.io/widgets/jobs/123,recent series A",
    ].join("\n");

    const out = csvParser.parse(raw) as ReturnType<
      typeof csvParser.parse
    > extends Promise<infer T>
      ? T
      : ReturnType<typeof csvParser.parse>;

    const rows = out as Awaited<ReturnType<typeof csvParser.parse>>;
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      type: "company",
      companyName: "Acme",
      companyDomain: "acme.com",
      jdUrl: null,
      hint: "founder lead",
    });

    expect(rows[1]).toMatchObject({
      type: "job",
      companyName: "Widgets",
      companyDomain: "widgets.io",
      jdUrl: "https://boards.greenhouse.io/widgets/jobs/123",
      hint: "recent series A",
    });
  });

  it("tolerates header variants (name / website / url)", () => {
    const raw = ["name,website,url", "Foo,foo.io,https://example.com/jobs/eng-1"].join(
      "\n",
    );
    const rows = csvParser.parse(raw) as Awaited<
      ReturnType<typeof csvParser.parse>
    >;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "job",
      companyName: "Foo",
      companyDomain: "foo.io",
      jdUrl: "https://example.com/jobs/eng-1",
    });
  });
});
