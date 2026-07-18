import type { EventConfigurationIssue } from "@shime/core";

const sectionDefinitions = [
  {
    key: "basic",
    title: "基本情報・開催期間",
    path: "settings",
    issueKeys: new Set(["name", "endsAt", "venueName", "venueAddress", "applicationOpensAt", "applicationClosesAt", "preferenceOpensAt", "preferenceClosesAt", "participantCategories", "conversationRounds", "retentionDays"]),
  },
  { key: "legal", title: "規約・プライバシー", path: "legal", issueKeys: new Set(["eventTermsVersion", "privacyVersion", "eventTermsDocument", "privacyDocument"]) },
  { key: "form", title: "申込フォーム項目", path: "form-fields", issueKeys: new Set(["formFields"]) },
  { key: "tables", title: "テーブル・席", path: "tables", issueKeys: new Set(["eventTables", "eventSeats"]) },
  { key: "dream", title: "Dream・感情カード", path: "dream", issueKeys: new Set(["cardSetCode", "dreamSettings"]) },
  { key: "questionnaire", title: "席案内5問", path: "questionnaire", issueKeys: new Set(["questionnaire"]) },
] as const;

export function buildEventSetupSections(eventId: string, issues: EventConfigurationIssue[]) {
  return sectionDefinitions.map((section) => {
    const sectionIssues = issues.filter((issue) => section.issueKeys.has(issue.key as never));
    return {
      key: section.key,
      title: section.title,
      href: `/admin/events/${eventId}/${section.path}`,
      complete: sectionIssues.length === 0,
      issues: sectionIssues,
    };
  });
}
