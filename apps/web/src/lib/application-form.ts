export const APPLICATION_STEPS = [
  { key: "overview", label: "概要" },
  { key: "details", label: "入力" },
  { key: "consent", label: "同意" },
  { key: "confirm", label: "確認" },
] as const;

export const PUBLIC_APPLICATION_FIELD_MAP = {
  full_name: "fullName",
  full_name_kana: "fullNameKana",
  birth_date: "birthDate",
  phone: "phone",
  email: "email",
  nickname: "nickname",
  residence_area: "residenceArea",
  participant_category: "participantCategory",
} as const;

export type PublicApplicationFieldKey = keyof typeof PUBLIC_APPLICATION_FIELD_MAP;
export type PublicApplicationInputName = (typeof PUBLIC_APPLICATION_FIELD_MAP)[PublicApplicationFieldKey];

export type PublicApplicationField = Readonly<{
  fieldKey: PublicApplicationFieldKey;
  inputName: PublicApplicationInputName;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select" | "checkbox";
  requirement: "required" | "optional";
  displayOrder: number;
  options: readonly { value: string; label: string }[];
}>;

type StoredField = Readonly<{
  fieldKey: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select" | "checkbox";
  requirement: "required" | "optional" | "hidden";
  displayOrder: number;
  validation: Record<string, unknown>;
}>;

const fallbackFields: readonly StoredField[] = [
  { fieldKey: "full_name", label: "氏名", type: "text", requirement: "required", displayOrder: 1, validation: {} },
  {
    fieldKey: "full_name_kana",
    label: "氏名かな",
    type: "text",
    requirement: "optional",
    displayOrder: 2,
    validation: {},
  },
  { fieldKey: "birth_date", label: "生年月日", type: "date", requirement: "required", displayOrder: 3, validation: {} },
  { fieldKey: "phone", label: "電話番号", type: "tel", requirement: "optional", displayOrder: 4, validation: {} },
  {
    fieldKey: "email",
    label: "メールアドレス",
    type: "email",
    requirement: "optional",
    displayOrder: 5,
    validation: {},
  },
  {
    fieldKey: "nickname",
    label: "ニックネーム",
    type: "text",
    requirement: "optional",
    displayOrder: 6,
    validation: {},
  },
  {
    fieldKey: "residence_area",
    label: "居住エリア",
    type: "text",
    requirement: "optional",
    displayOrder: 7,
    validation: {},
  },
  {
    fieldKey: "participant_category",
    label: "参加区分",
    type: "select",
    requirement: "required",
    displayOrder: 8,
    validation: {},
  },
];

export function buildPublicApplicationFields(
  storedFields: readonly StoredField[],
  participantCategories: readonly { code: string; label: string }[],
): PublicApplicationField[] {
  const source = storedFields.length ? storedFields : fallbackFields;
  return source
    .filter(
      (field): field is StoredField & { fieldKey: PublicApplicationFieldKey; requirement: "required" | "optional" } =>
        field.fieldKey in PUBLIC_APPLICATION_FIELD_MAP && field.requirement !== "hidden",
    )
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((field) => {
      const configuredOptions = Array.isArray(field.validation.options)
        ? field.validation.options
            .filter((option): option is string => typeof option === "string")
            .map((option) => ({ value: option, label: option }))
        : [];
      return {
        fieldKey: field.fieldKey,
        inputName: PUBLIC_APPLICATION_FIELD_MAP[field.fieldKey],
        label: field.label,
        type: field.type,
        requirement: field.requirement,
        displayOrder: field.displayOrder,
        options:
          field.fieldKey === "participant_category"
            ? participantCategories.map((category) => ({ value: category.code, label: category.label }))
            : configuredOptions,
      };
    });
}
