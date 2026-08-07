export type FormFieldType = "text" | "email" | "tel" | "date" | "select" | "checkbox";
export type FormFieldRequirement = "required" | "optional" | "hidden";

export type FormFieldRow = {
  fieldKey: string;
  label: string;
  type: FormFieldType;
  requirement: FormFieldRequirement;
  displayOrder: number;
  options: string;
};

export type FormFieldTemplate = { id: string; name: string; version: number; rows: FormFieldRow[] };

export const MARRIAGE_DAY_FORM_FIELDS: FormFieldRow[] = [
  { fieldKey: "full_name", label: "氏名", type: "text", requirement: "required", displayOrder: 1, options: "" },
  {
    fieldKey: "full_name_kana",
    label: "氏名かな",
    type: "text",
    requirement: "optional",
    displayOrder: 2,
    options: "",
  },
  {
    fieldKey: "nickname",
    label: "ニックネーム",
    type: "text",
    requirement: "optional",
    displayOrder: 3,
    options: "",
  },
  { fieldKey: "phone", label: "電話番号", type: "tel", requirement: "required", displayOrder: 4, options: "" },
  {
    fieldKey: "email",
    label: "メールアドレス",
    type: "email",
    requirement: "optional",
    displayOrder: 5,
    options: "",
  },
  {
    fieldKey: "birth_date",
    label: "生年月日",
    type: "date",
    requirement: "required",
    displayOrder: 6,
    options: "",
  },
  { fieldKey: "occupation", label: "職業", type: "text", requirement: "optional", displayOrder: 7, options: "" },
  { fieldKey: "hobbies", label: "趣味", type: "text", requirement: "optional", displayOrder: 8, options: "" },
  {
    fieldKey: "recent_happy_event",
    label: "最近あった嬉しいこと",
    type: "text",
    requirement: "optional",
    displayOrder: 9,
    options: "",
  },
  {
    fieldKey: "today_message",
    label: "今日の一言",
    type: "text",
    requirement: "optional",
    displayOrder: 10,
    options: "",
  },
  {
    fieldKey: "participant_category",
    label: "参加区分",
    type: "select",
    requirement: "required",
    displayOrder: 11,
    options: "",
  },
];

export function normalizeFormFieldOrder(rows: FormFieldRow[]): FormFieldRow[] {
  return rows.map((row, index) => ({ ...row, displayOrder: index + 1 }));
}

export function createMarriageDayFormFields(current: FormFieldRow[]): FormFieldRow[] {
  const currentByKey = new Map(current.map((field) => [field.fieldKey, field]));
  return MARRIAGE_DAY_FORM_FIELDS.map((field) => ({
    ...field,
    options: field.type === "select" ? (currentByKey.get(field.fieldKey)?.options ?? field.options) : field.options,
  }));
}
