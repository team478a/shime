"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
    if (!response.ok) {
      setError("ログインIDまたはパスワードが違います");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="login-form">
      <label>
        テナントコード
        <input name="tenantCode" required autoComplete="organization" />
      </label>
      <label>
        ログインID
        <input name="loginId" required autoComplete="username" />
      </label>
      <label>
        パスワード
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "確認中…" : "ログイン"}</button>
    </form>
  );
}
