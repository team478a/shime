import { describe, expect, it } from "vitest";
import { defaultEventFormFields, evaluateEventConfiguration, includeEventOperationalReadiness, includeLegalDocumentReadiness, validateContactFields, validateFormFieldRequirement, validateSeatConfiguration } from "@shime/core";

describe("event configuration", () => {
  it("does not hide protected fields", () => expect(() => validateFormFieldRequirement("full_name", "hidden")).toThrow());
  it("requires a visible contact method", () => expect(() => validateContactFields([{ fieldKey: "phone", requirement: "hidden" }, { fieldKey: "email", requirement: "hidden" }])).toThrow());
  it("rejects duplicate seat codes", () => expect(() => validateSeatConfiguration([{ capacity: 2, seats: [{ seatCode: "A1" }, { seatCode: "A1" }] }], 50)).toThrow());
  it("rejects duplicate table codes", () => expect(() => validateSeatConfiguration([{ tableCode: "T1", capacity: 1, seats: [{ seatCode: "A1" }] }, { tableCode: "T1", capacity: 1, seats: [{ seatCode: "B1" }] }], 50)).toThrow());
  it("warns when seats exceed event capacity", () => expect(validateSeatConfiguration([{ capacity: 2, seats: [{ seatCode: "A1" }, { seatCode: "A2" }] }], 1).exceedsEventCapacity).toBe(true));
});

describe("event configuration completeness", () => {
  const complete = {
    name: "SHIME event",
    startsAt: new Date("2026-08-08T05:00:00Z"),
    endsAt: new Date("2026-08-08T09:00:00Z"),
    venueName: "Test venue",
    venueAddress: "Test address",
    applicationOpensAt: new Date("2026-07-01T00:00:00Z"),
    applicationClosesAt: new Date("2026-08-01T00:00:00Z"),
    preferenceOpensAt: new Date("2026-08-08T07:00:00Z"),
    preferenceClosesAt: new Date("2026-08-08T08:00:00Z"),
    settings: {
      participantCategories: [{ code: "a", label: "A" }, { code: "b", label: "B" }],
      conversationRounds: 3,
      cardSetCode: "standard-v1",
      retentionDays: 90,
      eventTermsVersion: "2026-08-08",
      privacyVersion: "2026-08-08",
    },
  };

  it("accepts a complete configuration", () => {
    expect(evaluateEventConfiguration(complete)).toEqual({ complete: true, issues: [] });
  });

  it("lists missing settings without accepting placeholders", () => {
    const result = evaluateEventConfiguration({
      ...complete,
      venueName: "REQUIRED_INPUT: venue",
      settings: { ...complete.settings, participantCategories: [] },
    });
    expect(result.complete).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual(expect.arrayContaining(["venueName", "participantCategories"]));
  });

  it("rejects reversed date ranges", () => {
    const result = evaluateEventConfiguration({ ...complete, endsAt: complete.startsAt });
    expect(result.issues).toContainEqual({ key: "endsAt", label: "終了日時は開始日時より後", kind: "invalid" });
  });

  it("requires operational resources before accepting applications", () => {
    const result = includeEventOperationalReadiness(evaluateEventConfiguration(complete), {
      capacity: 50,
      formFields: defaultEventFormFields,
      tableCount: 0,
      enabledSeatCount: 0,
      hasDreamSettings: false,
      hasQuestionnaire: false,
    });
    expect(result.complete).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual(expect.arrayContaining(["eventTables", "eventSeats", "dreamSettings", "questionnaire"]));
  });

  it("accepts complete base settings and operational resources", () => {
    const result = includeEventOperationalReadiness(evaluateEventConfiguration(complete), {
      capacity: 50,
      formFields: defaultEventFormFields,
      tableCount: 10,
      enabledSeatCount: 50,
      hasDreamSettings: true,
      hasQuestionnaire: true,
    });
    expect(result).toEqual({ complete: true, issues: [] });
  });

  it("requires published legal documents matching the configured versions", () => {
    const result = includeLegalDocumentReadiness(evaluateEventConfiguration(complete), { hasPublishedEventTerms: false, hasPublishedPrivacy: true });
    expect(result.complete).toBe(false);
    expect(result.issues).toContainEqual({ key: "eventTermsDocument", label: "公開済みイベント規約", kind: "missing" });
  });

  it("does not duplicate a legal-document issue when its version is missing", () => {
    const configuration = evaluateEventConfiguration({ ...complete, settings: { ...complete.settings, privacyVersion: "REQUIRED_INPUT" } });
    const result = includeLegalDocumentReadiness(configuration, { hasPublishedEventTerms: true, hasPublishedPrivacy: false });
    expect(result.issues.filter((issue) => issue.key === "privacyVersion" || issue.key === "privacyDocument")).toHaveLength(1);
  });
});
