"use client";

import { useState } from "react";
import { type StaffRole } from "@shime/core/events/transitions";
import { type Permission, permissions, permissionsForRole } from "@shime/core/permissions/authorize";

const roleLabels: Record<StaffRole, string> = {
  reception: "受付担当",
  operator: "運営担当",
  manager: "責任者",
  system_admin: "システム管理者",
};

const permissionLabels: Record<Permission, string> = {
  "checkin:write": "受付を実行・取消",
  "participant:read": "参加者情報を閲覧",
  "operations:read": "運営進捗を閲覧",
  "application:import": "申込CSVを取込",
  "application:duplicates": "重複申込を確認・解決",
  "notification:write": "通知を作成・送信",
  "event:write": "イベント設定を編集",
  "event:delete": "イベントを削除（強い権限）",
  "seating:write": "席配置を作成・編集",
  "seating:publish": "席配置を公開",
  "preference:read": "希望情報を閲覧",
  "result:confirm": "結果を確定・通知",
  "result:revoke": "確定結果を取消（強い権限）",
  "backup:export": "運営CSVを出力",
  "backup:sensitive": "機微情報を含むCSVを出力",
  "staff:manage": "管理者・権限を変更（強い権限）",
  "concierge:manage": "診断コンテンツを編集",
  "concierge:publish": "診断コンテンツを公開",
  "concierge:private-read": "診断の非公開情報を閲覧",
};

export function StaffPermissionFields({
  initialRole,
  initialPermissions,
}: {
  initialRole: StaffRole;
  initialPermissions: Permission[];
}) {
  const [role, setRole] = useState(initialRole);
  const [selected, setSelected] = useState<Permission[]>(initialPermissions);
  return (
    <>
      <label>
        権限プリセット
        <select
          name="role"
          value={role}
          onChange={(event) => {
            const nextRole = event.target.value as StaffRole;
            setRole(nextRole);
            setSelected(permissionsForRole(nextRole));
          }}
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>個別権限</legend>
        <p>プリセットを選んだ後、必要な項目だけチェックを追加・解除できます。</p>
        <div className="option-grid">
          {permissions.map((permission) => (
            <label className="choice" key={permission}>
              <input
                type="checkbox"
                name="permissions"
                value={permission}
                checked={selected.includes(permission)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked ? [...current, permission] : current.filter((item) => item !== permission),
                  )
                }
              />
              {permissionLabels[permission]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
