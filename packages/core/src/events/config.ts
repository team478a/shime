const protectedFields = new Set(["full_name", "participant_category", "event_terms_consent", "privacy_consent"]);

export const defaultEventFormFields = [
  { fieldKey: "full_name", label: "氏名", type: "text", requirement: "required", displayOrder: 1 },
  { fieldKey: "full_name_kana", label: "氏名かな", type: "text", requirement: "optional", displayOrder: 2 },
  { fieldKey: "birth_date", label: "生年月日", type: "date", requirement: "required", displayOrder: 3 },
  { fieldKey: "phone", label: "電話番号", type: "tel", requirement: "required", displayOrder: 4 },
  { fieldKey: "email", label: "メールアドレス", type: "email", requirement: "optional", displayOrder: 5 },
  { fieldKey: "nickname", label: "ニックネーム", type: "text", requirement: "optional", displayOrder: 6 },
  { fieldKey: "residence_area", label: "居住エリア", type: "text", requirement: "optional", displayOrder: 7 },
  { fieldKey: "participant_category", label: "参加区分", type: "select", requirement: "required", displayOrder: 8 },
] as const;

export function validateFormFieldRequirement(fieldKey: string, requirement: "required" | "optional" | "hidden"): void {
  if (protectedFields.has(fieldKey) && requirement === "hidden") throw new Error(`${fieldKey} cannot be hidden`);
}

export function validateContactFields(fields: ReadonlyArray<{ fieldKey: string; requirement: "required" | "optional" | "hidden" }>): void {
  const hasContact = fields.some((field) => ["phone", "email"].includes(field.fieldKey) && field.requirement !== "hidden");
  if (!hasContact) throw new Error("At least one of phone or email must be visible");
}

export function validateSeatConfiguration(tables: ReadonlyArray<{ tableCode?: string; capacity: number; seats: ReadonlyArray<{ seatCode: string }> }>, eventCapacity: number) {
  const tableCodes = tables.map((table) => table.tableCode).filter((code): code is string => typeof code === "string");
  if (tableCodes.length && new Set(tableCodes).size !== tableCodes.length) throw new Error("Table codes must be unique within an event");
  const codes = tables.flatMap((table) => table.seats.map((seat) => seat.seatCode));
  if (new Set(codes).size !== codes.length) throw new Error("Seat codes must be unique within an event");
  if (tables.some((table) => table.capacity < 1 || table.capacity < table.seats.length)) throw new Error("Table capacity cannot be lower than its seat count");
  return { exceedsEventCapacity: codes.length > eventCapacity };
}

export type EventConfigurationSnapshot = {
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  applicationOpensAt: Date | null;
  applicationClosesAt: Date | null;
  preferenceOpensAt: Date | null;
  preferenceClosesAt: Date | null;
  settings: Record<string, unknown>;
};

export type EventConfigurationIssue = {
  key: string;
  label: string;
  kind: "missing" | "invalid";
};

export type EventOperationalResources = {
  capacity: number;
  formFields: ReadonlyArray<{ fieldKey: string; requirement: "required" | "optional" | "hidden" }>;
  tableCount: number;
  enabledSeatCount: number;
  hasDreamSettings: boolean;
  hasQuestionnaire: boolean;
};

export function includeEventOperationalReadiness(
  configuration: { complete: boolean; issues: EventConfigurationIssue[] },
  resources: EventOperationalResources,
): { complete: boolean; issues: EventConfigurationIssue[] } {
  const issues = [...configuration.issues];
  const visibleKeys = new Set(resources.formFields.filter((field) => field.requirement !== "hidden").map((field) => field.fieldKey));
  if (!["full_name", "birth_date", "participant_category"].every((key) => visibleKeys.has(key)) || !["phone", "email"].some((key) => visibleKeys.has(key))) {
    issues.push({ key: "formFields", label: "申込フォーム必須項目", kind: "missing" });
  }
  if (resources.tableCount < 1) issues.push({ key: "eventTables", label: "テーブル設定", kind: "missing" });
  if (resources.enabledSeatCount < resources.capacity) issues.push({ key: "eventSeats", label: `有効な席（定員${resources.capacity}席以上）`, kind: "missing" });
  if (!resources.hasDreamSettings) issues.push({ key: "dreamSettings", label: "Dream・感情カード設定", kind: "missing" });
  if (!resources.hasQuestionnaire) issues.push({ key: "questionnaire", label: "席案内5問設定", kind: "missing" });
  return { complete: issues.length === 0, issues };
}

export function includeLegalDocumentReadiness(
  configuration: { complete: boolean; issues: EventConfigurationIssue[] },
  documents: { hasPublishedEventTerms: boolean; hasPublishedPrivacy: boolean },
): { complete: boolean; issues: EventConfigurationIssue[] } {
  const issues = [...configuration.issues];
  if (!issues.some((issue) => issue.key === "eventTermsVersion") && !documents.hasPublishedEventTerms) {
    issues.push({ key: "eventTermsDocument", label: "公開済みイベント規約", kind: "missing" });
  }
  if (!issues.some((issue) => issue.key === "privacyVersion") && !documents.hasPublishedPrivacy) {
    issues.push({ key: "privacyDocument", label: "公開済みプライバシーポリシー", kind: "missing" });
  }
  return { complete: issues.length === 0, issues };
}

const requiredSettings = [
  ["conversationRounds", "席替え回数"],
  ["cardSetCode", "感情カードセット"],
  ["retentionDays", "保存日数"],
  ["eventTermsVersion", "イベント規約版"],
  ["privacyVersion", "プライバシーポリシー版"],
] as const;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.startsWith("REQUIRED_INPUT");
}

export function evaluateEventConfiguration(event: EventConfigurationSnapshot): {
  complete: boolean;
  issues: EventConfigurationIssue[];
} {
  const issues: EventConfigurationIssue[] = [];
  const requireText = (key: string, label: string, value: unknown) => {
    if (!hasText(value)) issues.push({ key, label, kind: "missing" });
  };
  const requireDate = (key: string, label: string, value: Date | null) => {
    if (!value) issues.push({ key, label, kind: "missing" });
  };

  requireText("name", "正式イベント名", event.name);
  requireDate("endsAt", "終了日時", event.endsAt);
  requireText("venueName", "会場名", event.venueName);
  requireText("venueAddress", "会場住所", event.venueAddress);
  requireDate("applicationOpensAt", "受付開始日時", event.applicationOpensAt);
  requireDate("applicationClosesAt", "受付終了日時", event.applicationClosesAt);
  requireDate("preferenceOpensAt", "希望入力開始日時", event.preferenceOpensAt);
  requireDate("preferenceClosesAt", "希望入力締切日時", event.preferenceClosesAt);

  const categories = event.settings.participantCategories;
  if (!Array.isArray(categories) || categories.length < 2 || categories.some((category) => {
    if (!category || typeof category !== "object") return true;
    const item = category as Record<string, unknown>;
    return !hasText(item.code) || !hasText(item.label);
  })) {
    issues.push({ key: "participantCategories", label: "参加区分（2区分以上）", kind: "missing" });
  }

  for (const [key, label] of requiredSettings) {
    const value = event.settings[key];
    if (["conversationRounds", "retentionDays"].includes(key)) {
      if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) issues.push({ key, label, kind: "missing" });
    } else if (!hasText(value)) {
      issues.push({ key, label, kind: "missing" });
    }
  }

  if (event.endsAt && event.endsAt <= event.startsAt) {
    issues.push({ key: "endsAt", label: "終了日時は開始日時より後", kind: "invalid" });
  }
  if (event.applicationOpensAt && event.applicationClosesAt && event.applicationClosesAt <= event.applicationOpensAt) {
    issues.push({ key: "applicationClosesAt", label: "受付終了は受付開始より後", kind: "invalid" });
  }
  if (event.preferenceOpensAt && event.preferenceClosesAt && event.preferenceClosesAt <= event.preferenceOpensAt) {
    issues.push({ key: "preferenceClosesAt", label: "希望入力締切は開始より後", kind: "invalid" });
  }

  return { complete: issues.length === 0, issues };
}
