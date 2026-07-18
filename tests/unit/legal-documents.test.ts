import { describe, expect, it } from "vitest";
import { isLegalDocumentType, withPublishedLegalVersion } from "../../apps/web/src/server/legal-documents";

describe("legal documents", () => {
  it("updates only the event-terms version while preserving other event settings", () => {
    expect(withPublishedLegalVersion({ privacyVersion: "privacy-v1", conversationRounds: 3 }, "event_terms", "terms-v2")).toEqual({ privacyVersion: "privacy-v1", eventTermsVersion: "terms-v2", conversationRounds: 3 });
  });

  it("updates only the privacy version", () => {
    expect(withPublishedLegalVersion({ eventTermsVersion: "terms-v1" }, "privacy", "privacy-v2")).toEqual({ eventTermsVersion: "terms-v1", privacyVersion: "privacy-v2" });
  });

  it("accepts only supported public document types", () => {
    expect(isLegalDocumentType("event_terms")).toBe(true);
    expect(isLegalDocumentType("privacy")).toBe(true);
    expect(isLegalDocumentType("internal_policy")).toBe(false);
  });
});
