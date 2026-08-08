import type {
  InteractionPublicProfile,
  InteractionPublicProfileFieldKey,
  InteractionPublicProfileSource,
} from "./types";

const FIELD_LABELS: Record<InteractionPublicProfileFieldKey, string> = {
  nickname: "ニックネーム",
  age: "年齢",
  age_or_band: "年代",
  residence_municipality: "居住地域",
  occupation: "職業",
  hobbies: "趣味",
  recent_happy_event: "最近あった嬉しいこと",
  today_message: "今日の一言",
  holiday_style: "休日の過ごし方",
  support_wanted: "応援してほしいこと",
  support_offered: "応援できること",
  public_dream: "Dream",
};

const cleanValue = (value: string | null | undefined, maxLength = 240) => {
  const normalized = value?.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

export function calculateAge(birthDate: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = now.getUTCFullYear() - year;
  const birthdayPassed = now.getUTCMonth() + 1 > month || (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  if (!birthdayPassed) age -= 1;
  if (age < 18 || age > 120) return null;
  return age;
}

export function toAgeBand(birthDate: string, now: Date): string | null {
  const age = calculateAge(birthDate, now);
  return age === null ? null : `${Math.floor(age / 10) * 10}代`;
}

export function toMunicipality(value: string | null): string | null {
  const normalized = cleanValue(value?.replace(/[〒\s]/g, "") ?? null, 120);
  if (!normalized) return null;
  const prefecture = normalized.match(/^.{2,4}?[都道府県]/)?.[0] ?? "";
  const rest = normalized.slice(prefecture.length);
  const designatedCityWard = rest.match(/^.{1,12}?市.{1,12}?区/)?.[0];
  const municipality = designatedCityWard ?? rest.match(/^.{1,20}?(?:市|区|町|村)/)?.[0];
  return municipality ? `${prefecture}${municipality}` : null;
}

function valueFor(
  key: InteractionPublicProfileFieldKey,
  source: InteractionPublicProfileSource,
  now: Date,
): string | null {
  switch (key) {
    case "nickname":
      return cleanValue(source.nickname, 120);
    case "age": {
      const age = calculateAge(source.birthDate, now);
      return age === null ? null : `${age}歳`;
    }
    case "age_or_band":
      return toAgeBand(source.birthDate, now);
    case "residence_municipality":
      return toMunicipality(source.residenceArea);
    case "public_dream":
      return cleanValue(source.publicDream, 500);
    default:
      return cleanValue(source.additionalAnswers[key], 240);
  }
}

export function buildInteractionPublicProfile(
  source: InteractionPublicProfileSource,
  allowedKeys: InteractionPublicProfileFieldKey[],
  now: Date,
): InteractionPublicProfile {
  return {
    participantNumber: source.participantNumber,
    fields: allowedKeys.flatMap((key) => {
      const value = valueFor(key, source, now);
      return value ? [{ key, label: FIELD_LABELS[key], value }] : [];
    }),
  };
}
