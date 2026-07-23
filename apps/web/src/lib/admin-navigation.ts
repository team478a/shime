import { hasPermission, type Permission, type StaffRole } from "@shime/core";

export type AdminNavigationItem = Readonly<{
  key: string;
  label: string;
  href: string;
  permission?: Permission;
  systemAdminOnly?: boolean;
  tenantScopeOnly?: boolean;
}>;

export type AdminNavigationGroup = Readonly<{
  key: string;
  label: string;
  items: readonly AdminNavigationItem[];
}>;

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  reception: "受付担当",
  operator: "運営担当",
  manager: "運営責任者",
  system_admin: "システム管理者",
};

const primaryItems: readonly AdminNavigationItem[] = [
  { key: "dashboard", label: "管理トップ", href: "/admin" },
  { key: "new-event", label: "イベント作成", href: "/admin/events/new", permission: "event:write" },
  {
    key: "venue-templates",
    label: "会場テンプレート",
    href: "/admin/templates/venue-layouts",
    permission: "event:write",
    tenantScopeOnly: true,
  },
  {
    key: "concierge",
    label: "診断・カード管理",
    href: "/admin/concierge",
    permission: "concierge:manage",
    tenantScopeOnly: true,
  },
  { key: "staff", label: "管理者・権限", href: "/admin/staff", systemAdminOnly: true },
  { key: "platform", label: "外部接続・運用設定", href: "/admin/platform", systemAdminOnly: true },
];

const eventItemTemplates: readonly AdminNavigationGroup[] = [
  {
    key: "setup",
    label: "イベント設定",
    items: [
      { key: "setup", label: "設定チェック", href: "setup", permission: "event:write" },
      { key: "settings", label: "基本設定", href: "settings", permission: "event:write" },
      { key: "legal", label: "規約・プライバシー", href: "legal", permission: "event:write" },
      { key: "tables", label: "テーブル・席マスター", href: "tables", permission: "event:write" },
      { key: "form-fields", label: "申込フォーム項目", href: "form-fields", permission: "event:write" },
      { key: "dream", label: "Dream設定", href: "dream", permission: "event:write" },
      { key: "questionnaire", label: "席案内5問", href: "questionnaire", permission: "event:write" },
      { key: "concierge-event", label: "診断テンプレート適用", href: "concierge", permission: "concierge:manage" },
    ],
  },
  {
    key: "participants",
    label: "参加者管理",
    items: [
      { key: "participants", label: "参加者・LINE連携", href: "participants", permission: "event:write" },
      { key: "imports", label: "CSV取込・重複確認", href: "imports", permission: "application:import" },
    ],
  },
  {
    key: "event-day",
    label: "当日運営",
    items: [
      { key: "analytics", label: "運営進捗", href: "analytics", permission: "operations:read" },
      { key: "checkin", label: "受付", href: "checkin", permission: "checkin:write" },
      { key: "seating", label: "席配置", href: "seating", permission: "seating:write" },
    ],
  },
  {
    key: "results",
    label: "結果・記録",
    items: [
      { key: "results", label: "希望・結果確定", href: "results", permission: "preference:read" },
      { key: "exports", label: "CSVバックアップ", href: "exports", permission: "backup:export" },
    ],
  },
];

function canAccess(role: StaffRole, item: AdminNavigationItem) {
  if (item.systemAdminOnly) return role === "system_admin";
  return !item.permission || hasPermission(role, item.permission);
}

export function getAdminPrimaryNavigation(role: StaffRole, eventScoped = false) {
  return primaryItems.filter((item) => canAccess(role, item) && !(eventScoped && item.tenantScopeOnly));
}

export function getEventAdminNavigation(role: StaffRole, eventId: string) {
  const base = `/admin/events/${encodeURIComponent(eventId)}`;
  return eventItemTemplates.flatMap((group) => {
    const items = group.items
      .filter((item) => canAccess(role, item))
      .map((item) => ({ ...item, href: `${base}/${item.href}` }));
    return items.length ? [{ ...group, items }] : [];
  });
}

export function getEventAdminQuickActions(role: StaffRole, eventId: string) {
  const quickActionKeys = new Set(["checkin", "participants", "seating"]);
  return getEventAdminNavigation(role, eventId)
    .flatMap((group) => group.items)
    .filter((item) => quickActionKeys.has(item.key));
}
