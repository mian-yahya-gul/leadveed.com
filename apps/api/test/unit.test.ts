import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { grade, maskEmail, maskPhone, maskUrl } from "../src/lib/leads.js";
import { SearchQuery, typesenseParams } from "../src/lib/search.js";
import { verifySignature } from "../src/routes/billing.js";

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

describe("lemon squeezy signature", () => {
  it("accepts a valid HMAC and rejects others", () => {
    const raw = Buffer.from('{"a":1}');
    const sig = createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(verifySignature(raw, sig, "s3cret")).toBe(true);
    expect(verifySignature(raw, sig, "other")).toBe(false);
    expect(verifySignature(raw, undefined, "s3cret")).toBe(false);
  });
});
