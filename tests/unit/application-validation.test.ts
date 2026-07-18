import { describe, expect, it } from "vitest";
import { applicationDiff, applicationInputSchema, duplicateReasons, hashIdempotencyKey, normalizeEmail, normalizePhone, parseApplicationCsv, shouldProvisionParticipant } from "@shime/core";

const base = { fullName: "山田 花子", phone: "090-1234-5678", birthDate: "1990-04-15", participantCategory: "group_a", status: "confirmed" as const };
describe("application validation", () => {
  it("provisions participants only for confirmed applications", () => {
    expect(shouldProvisionParticipant("confirmed")).toBe(true);
    for (const status of ["draft", "submitted", "cancelled", "rejected", "waitlisted"] as const) expect(shouldProvisionParticipant(status)).toBe(false);
  });
  it("normalizes contacts", () => { expect(normalizePhone("+81 90-1234-5678")).toBe("09012345678"); expect(normalizeEmail(" A@EXAMPLE.COM ")).toBe("a@example.com"); });
  it("requires phone or email", () => expect(applicationInputSchema.safeParse({ ...base, phone: undefined }).success).toBe(false));
  it("detects duplicates without merging", () => expect(duplicateReasons(base, { ...base, fullName: "山田花子" })).toEqual(expect.arrayContaining(["phone", "full_name_and_birth_date"])));
  it("produces deterministic idempotency hashes", () => expect(hashIdempotencyKey("request-123456789")).toBe(hashIdempotencyKey("request-123456789")));
  it("previews re-import differences", () => expect(applicationDiff({ ...base, nickname: "旧" }, { ...base, nickname: "新" })).toContain("nickname"));
  it("returns CSV row numbers and duplicate external IDs", () => {
    const csv = "external_id,full_name,phone,email,birth_date,participant_category,application_status\nX1,山田花子,09012345678,,1990-04-15,group_a,confirmed\nX1,佐藤太郎,08012345678,,1988-09-20,group_b,confirmed";
    const result = parseApplicationCsv(csv); expect(result.rows[0]?.level).toBe("valid"); expect(result.rows[1]?.rowNumber).toBe(3); expect(result.rows[1]?.issues[0]?.code).toBe("DUPLICATE_IN_FILE");
  });
  it("marks malformed CSV values with their source row", () => { const csv = "external_id,full_name,phone,email,birth_date,participant_category,application_status\nX1,,,bad,not-a-date,group_a,confirmed"; const row = parseApplicationCsv(csv).rows[0]; expect(row?.rowNumber).toBe(2); expect(row?.level).toBe("error"); expect(row?.issues.length).toBeGreaterThan(0); });
});
