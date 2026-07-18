# Vercel 公開環境の運用点検

## 現在の方針

- `staging` は `robots.txt`、HTML metadata、`X-Robots-Tag` の3層で検索登録を拒否する。
- 公開ヘルスチェックはDB、テナント、イベント、バージョンなどの内部情報を返さない。
- DB接続確認と通知ジョブは `INTERNAL_JOB_SECRET` で保護する。
- 運用ログは許可した項目だけをJSONで出力し、例外文字列、個人ID、LINE ID、トークン、通知本文を出力しない。
- LINE接続前のためVercel Cronはまだ登録しない。

## エンドポイント

### 公開生存確認

```text
GET /api/health
```

200と `{"status":"ok", ...}` が返ることを確認する。このエンドポイントは外部監視から呼び出してよい。

### DB準備状態の確認

PowerShellでローカル `.env` の値を使う例。秘密値自体は画面、チャット、ログに貼らない。

```powershell
$headers = @{ Authorization = "Bearer $env:INTERNAL_JOB_SECRET" }
Invoke-RestMethod -Uri "$env:APP_URL/api/health/readiness" -Headers $headers
```

200と `checks.database = "ok"` を確認する。未認証リクエストは401になる。

### 通知ジョブの手動確認

```powershell
$headers = @{ Authorization = "Bearer $env:INTERNAL_JOB_SECRET" }
Invoke-RestMethod -Method Post -Uri "$env:APP_URL/api/jobs/notifications" -Headers $headers
```

通知キューが空なら `processed = 0`、`sent = 0`、`failed = 0` になる。LINEの本番チャネル設定、少数の検証宛先での送信確認、管理者承認が終わるまで自動Cronは追加しない。

## セキュリティヘッダー

`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`、HSTSを全ページに付与する。CSPはLINE Login、LIFF、QRカメラの接続先確定後にReport-Onlyで検証してから強制する。
