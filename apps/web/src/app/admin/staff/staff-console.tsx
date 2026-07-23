"use client";

import { useState, type FormEvent } from "react";

type Role = "reception" | "operator" | "manager" | "system_admin";
type Status = "active" | "locked" | "disabled";
type Staff = {
  id: string;
  loginId: string;
  displayName: string;
  role: Role;
  status: Status;
  lastLoginAt: string | null;
};
const roleLabels: Record<Role, string> = {
  reception: "受付担当",
  operator: "運営担当",
  manager: "責任者",
  system_admin: "システム管理者",
};

export function StaffConsole({ initial }: { initial: Staff[] }) {
  const [staff, setStaff] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const response = await fetch("/api/admin/staff");
    const body = await response.json();
    if (response.ok) setStaff(body.data);
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const body = await response.json();
    setBusy(false);
    setMessage(response.ok ? "管理者を追加しました。" : `追加できません: ${body.code}`);
    if (response.ok) {
      event.currentTarget.reset();
      await reload();
    }
  }
  async function save(item: Staff, form: HTMLFormElement) {
    setBusy(true);
    setMessage("");
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const body = {
      displayName: values.get("displayName"),
      role: values.get("role"),
      status: values.get("status"),
      ...(password ? { password } : {}),
    };
    const response = await fetch(`/api/admin/staff/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "管理者情報を更新しました。" : `更新できません: ${result.code}`);
    if (response.ok) await reload();
  }
  return (
    <div className="admin-stack">
      <section className="panel wide">
        <p className="eyebrow">STAFF ACCESS</p>
        <h1>管理者・権限</h1>
        <p>パスワードは12文字以上の英数字で設定します。変更時は対象アカウントのセッションを失効させます。</p>
        <form className="login-form" onSubmit={create}>
          <h2>管理者を追加</h2>
          <label>
            ログインID
            <input name="loginId" pattern="[a-z0-9._-]{3,255}" required />
          </label>
          <label>
            表示名
            <input name="displayName" required />
          </label>
          <label>
            権限
            <select name="role" defaultValue="operator">
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            初期パスワード
            <input name="password" type="password" minLength={12} required autoComplete="new-password" />
          </label>
          <button disabled={busy}>管理者を追加</button>
        </form>
      </section>
      <section className="panel wide">
        <h2>登録済み管理者</h2>
        {staff.map((item) => (
          <form
            key={item.id}
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save(item, event.currentTarget);
            }}
          >
            <h3>{item.loginId}</h3>
            <label>
              表示名
              <input name="displayName" defaultValue={item.displayName} required />
            </label>
            <div className="settings-grid">
              <label>
                権限
                <select name="role" defaultValue={item.role}>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状態
                <select name="status" defaultValue={item.status}>
                  <option value="active">有効</option>
                  <option value="locked">ロック</option>
                  <option value="disabled">無効</option>
                </select>
              </label>
            </div>
            <label>
              新しいパスワード（変更時のみ）
              <input name="password" type="password" minLength={12} autoComplete="new-password" />
            </label>
            <button disabled={busy}>更新</button>
          </form>
        ))}
        <div className="actions">
          <a className="button-link secondary" href="/admin">
            管理トップへ
          </a>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  );
}
