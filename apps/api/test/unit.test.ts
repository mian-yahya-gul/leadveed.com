import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { grade, maskEmail, maskPhone, maskUrl } from "../src/lib/leads.js";
import { SearchQuery, typesenseParams } from "../src/lib/search.js";
import { verifyPaddleSignature } from "../src/routes/billing.js";

describe("masking", () => {
  it("hides the middle of phone numbers", () => {
    expect(maskPhone("+92 300 1234567")).toBe("+92 300 •••••67");
    expect(maskPhone("+923001234567")).not.toContain("12345");
  });
  it("hides emails and websites", () => {
    expect(maskEmail("sales@acme.co.uk")).toBe("s•••@•••.uk");
    expect(maskUrl("https://www.acme.com/contact")).toBe("•••••••.com");
  });
  it("grades scores", () => {
    expect([grade(90), grade(60), grade(40), grade(10)]).toEqual(["A", "B", "C", "D"]);
  });
});

describe("typesense query", () => {
  it("builds filters", () => {
    const q = SearchQuery.parse({ q: "dentist", country: "pk,ae", city: "Lahore", has_website: "false", min_quality: "60" });
    const p = typesenseParams(q);
    expect(p.filter_by).toBe("country:[`PK`,`AE`] && city:[`Lahore`] && has_website:false && quality_score:>=60");
    expect(p.sort_by).toBe("_text_match:desc,quality_score:desc");
  });
  it("strips backticks so filters cannot be broken out of", () => {
    const p = typesenseParams(SearchQuery.parse({ city: "La`] || country:[`US" }));
    expect(p.filter_by).toBe("city:[`La] || country:[US`]");
  });
});

describe("paddle signature", () => {
  const raw = Buffer.from('{"a":1}');
  const sign = (ts: number, secret: string) => createHmac("sha256", secret).update(`${ts}:`).update(raw).digest("hex");
  it("accepts a valid, fresh signature and rejects others", () => {
    const now = 1_800_000_000;
    expect(verifyPaddleSignature(raw, `ts=${now};h1=${sign(now, "s3cret")}`, "s3cret", now)).toBe(true);
    expect(verifyPaddleSignature(raw, `ts=${now};h1=${sign(now, "s3cret")}`, "other", now)).toBe(false);
    expect(verifyPaddleSignature(raw, undefined, "s3cret", now)).toBe(false);
    expect(verifyPaddleSignature(raw, `ts=${now};h1=nope`, "s3cret", now)).toBe(false);
  });
  it("rejects old signatures and accepts any h1 during secret rotation", () => {
    const now = 1_800_000_000, old = now - 3600;
    expect(verifyPaddleSignature(raw, `ts=${old};h1=${sign(old, "s3cret")}`, "s3cret", now)).toBe(false);
    expect(verifyPaddleSignature(raw, `ts=${now};h1=${sign(now, "previous")};h1=${sign(now, "s3cret")}`, "s3cret", now)).toBe(true);
  });
});

describe("search routing", async () => {
  const { config } = await import("../src/config.js");
  const { useTypesense } = await import("../src/lib/search.js");
  it("uses Typesense only for countries it holds", () => {
    Object.assign(config, { typesenseUrl: "http://ts", typesenseCountries: ["PK", "AE"] });
    expect(useTypesense(SearchQuery.parse({ country: "pk" }))).toBe(true);
    expect(useTypesense(SearchQuery.parse({ country: "PK,DE" }))).toBe(false);
    expect(useTypesense(SearchQuery.parse({}))).toBe(false);
    Object.assign(config, { typesenseCountries: [] });
    expect(useTypesense(SearchQuery.parse({}))).toBe(true);
    Object.assign(config, { typesenseUrl: "" });
    expect(useTypesense(SearchQuery.parse({ country: "PK" }))).toBe(false);
  });
});
