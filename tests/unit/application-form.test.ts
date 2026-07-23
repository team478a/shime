import { describe, expect, it } from "vitest";

import { APPLICATION_STEPS, buildPublicApplicationFields } from "../../apps/web/src/lib/application-form";

const stored = [
  {
    fieldKey: "full_name",
    label: "お名前",
    type: "text" as const,
    requirement: "required" as const,
    displayOrder: 2,
    validation: {},
  },
  {
    fieldKey: "phone",
    label: "電話",
    type: "tel" as const,
    requirement: "optional" as const,
    displayOrder: 3,
    validation: {},
  },
  {
    fieldKey: "email",
    label: "メール",
    type: "email" as const,
    requirement: "hidden" as const,
    displayOrder: 4,
    validation: {},
  },
  {
    fieldKey: "participant_category",
    label: "参加区分",
    type: "select" as const,
    requirement: "required" as const,
    displayOrder: 5,
    validation: {},
  },
  {
    fieldKey: "custom_question",
    label: "未対応項目",
    type: "text" as const,
    requirement: "optional" as const,
    displayOrder: 1,
    validation: {},
  },
];

describe("public application form", () => {
  it("uses the approved application step order", () => {
    expect(APPLICATION_STEPS.map((step) => step.key)).toEqual(["overview", "details", "consent", "confirm"]);
  });

  it("applies labels, visibility, order and participant categories from event settings", () => {
    const fields = buildPublicApplicationFields(stored, [
      { code: "a", label: "区分A設定値" },
      { code: "b", label: "区分B設定値" },
    ]);
    expect(fields.map((field) => field.fieldKey)).toEqual(["full_name", "phone", "participant_category"]);
    expect(fields[0]).toMatchObject({ label: "お名前", inputName: "fullName", requirement: "required" });
    expect(fields.find((field) => field.fieldKey === "participant_category")?.options).toEqual([
      { value: "a", label: "区分A設定値" },
      { value: "b", label: "区分B設定値" },
    ]);
  });

  it("does not collect unsupported custom fields until storage support exists", () => {
    expect(buildPublicApplicationFields(stored, []).map((field) => String(field.fieldKey))).not.toContain(
      "custom_question",
    );
  });

  it("provides the standard form when no field rows exist", () => {
    const fields = buildPublicApplicationFields(
      [],
      [
        { code: "a", label: "A" },
        { code: "b", label: "B" },
      ],
    );
    expect(fields.map((field) => field.fieldKey)).toEqual([
      "full_name",
      "full_name_kana",
      "birth_date",
      "phone",
      "email",
      "nickname",
      "residence_area",
      "participant_category",
    ]);
  });
});
