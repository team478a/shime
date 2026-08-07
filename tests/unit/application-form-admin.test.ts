import { describe, expect, it } from "vitest";

import {
  createMarriageDayFormFields,
  MARRIAGE_DAY_FORM_FIELDS,
  normalizeFormFieldOrder,
} from "../../apps/web/src/app/admin/events/[eventId]/form-fields/form-field-config";

describe("application form admin preset", () => {
  it("keeps the requested marriage-event order and required matching category", () => {
    expect(MARRIAGE_DAY_FORM_FIELDS.map((field) => field.fieldKey)).toEqual([
      "full_name",
      "full_name_kana",
      "nickname",
      "phone",
      "email",
      "birth_date",
      "occupation",
      "hobbies",
      "recent_happy_event",
      "today_message",
      "participant_category",
    ]);
    expect(MARRIAGE_DAY_FORM_FIELDS.find((field) => field.fieldKey === "birth_date")?.requirement).toBe("required");
    expect(MARRIAGE_DAY_FORM_FIELDS.find((field) => field.fieldKey === "participant_category")?.displayOrder).toBe(11);
  });

  it("recalculates display order after a move or removal", () => {
    const normalized = normalizeFormFieldOrder([
      { ...MARRIAGE_DAY_FORM_FIELDS[2]!, displayOrder: 50 },
      { ...MARRIAGE_DAY_FORM_FIELDS[0]!, displayOrder: 80 },
    ]);

    expect(normalized.map((field) => field.displayOrder)).toEqual([1, 2]);
  });

  it("preserves existing participant-category options when applying the preset", () => {
    const current = [
      {
        ...MARRIAGE_DAY_FORM_FIELDS[10]!,
        options: "男性, 女性",
      },
    ];

    const fields = createMarriageDayFormFields(current);

    expect(fields.find((field) => field.fieldKey === "participant_category")?.options).toBe("男性, 女性");
  });
});
