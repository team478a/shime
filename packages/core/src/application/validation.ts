import { createHash } from "node:crypto";
import { z } from "zod";

export const applicationStatuses = ["draft", "submitted", "confirmed", "cancelled", "rejected", "waitlisted"] as const;

export const applicationFieldsSchema = z.object({
  externalId: z.string().trim().min(1).max(160).optional(),
  status: z.enum(applicationStatuses).default("submitted"),
  fullName: z.string().trim().min(1).max(160),
  fullNameKana: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(320).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidDate, "Invalid date"),
  nickname: z.string().trim().max(120).optional(),
  residenceArea: z.string().trim().max(240).optional(),
  participantCategory: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(2_000).optional(),
});

export const applicationInputSchema = applicationFieldsSchema.refine((value) => Boolean(value.phone || value.email), {
  message: "Phone or email is required",
  path: ["phone"],
});

export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export function shouldProvisionParticipant(status: ApplicationInput["status"]): boolean {
  return status === "confirmed";
}

function isValidDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function normalizePhone(value?: string): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("81") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits || null;
}

export function normalizeEmail(value?: string): string | null {
  return value?.trim().toLowerCase() || null;
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .toLowerCase();
}

export function hashIdempotencyKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function duplicateReasons(a: ApplicationInput, b: ApplicationInput): string[] {
  const reasons: string[] = [];
  if (normalizePhone(a.phone) && normalizePhone(a.phone) === normalizePhone(b.phone)) reasons.push("phone");
  if (normalizeEmail(a.email) && normalizeEmail(a.email) === normalizeEmail(b.email)) reasons.push("email");
  if (normalizeName(a.fullName) === normalizeName(b.fullName) && a.birthDate === b.birthDate)
    reasons.push("full_name_and_birth_date");
  return reasons;
}

export function applicationDiff(
  existing: Partial<Record<keyof ApplicationInput, unknown>>,
  incoming: ApplicationInput,
): string[] {
  const keys: Array<keyof ApplicationInput> = [
    "status",
    "fullName",
    "fullNameKana",
    "phone",
    "email",
    "birthDate",
    "nickname",
    "residenceArea",
    "participantCategory",
    "notes",
  ];
  return keys.filter((key) => (existing[key] ?? null) !== (incoming[key] ?? null)).map(String);
}
