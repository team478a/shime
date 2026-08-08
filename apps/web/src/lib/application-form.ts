import { defaultEventFormFields } from "@shime/core/events/config";

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
export type PublicApplicationInputName = string;

export type PublicApplicationField = Readonly<{
  fieldKey: string;
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

const fallbackFields: readonly StoredField[] = defaultEventFormFields.map((field) => ({
  ...field,
  validation: {},
}));

export function buildPublicApplicationFields(
  storedFields: readonly StoredField[],
  participantCategories: readonly { code: string; label: string }[],
): PublicApplicationField[] {
  const source = storedFields.length ? storedFields : fallbackFields;
  return source
    .filter((field): field is StoredField & { requirement: "required" | "optional" } => field.requirement !== "hidden")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((field) => {
      const configuredOptions = Array.isArray(field.validation.options)
        ? field.validation.options
            .filter((option): option is string => typeof option === "string")
            .map((option) => ({ value: option, label: option }))
        : [];
      return {
        fieldKey: field.fieldKey,
        inputName:
          field.fieldKey in PUBLIC_APPLICATION_FIELD_MAP
            ? PUBLIC_APPLICATION_FIELD_MAP[field.fieldKey as PublicApplicationFieldKey]
            : field.fieldKey,
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
