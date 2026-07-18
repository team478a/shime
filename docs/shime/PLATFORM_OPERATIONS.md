# 外部接続・運用設定

`/admin/platform` は system_admin 専用です。LINE、OpenAI、独自ドメイン確認、監視、通知ジョブ、通知テンプレートをテナント単位で管理します。

## 秘密情報

- LINE Channel Secret、Channel Access Token、OpenAI API Key は保存後に再表示しません。
- DB保存時は `SETTINGS_ENCRYPTION_KEY` による AES-256-GCM 暗号化を行い、画面には短いフィンガープリントだけを表示します。
- 秘密値を空欄のまま保存した場合は既存値を維持します。
- `.env` とVercelのSensitive環境変数はGitへ登録しません。

## LINE Developers

画面からLINE Login Channel ID、LIFF ID、Messaging API Channel Secret、Channel Access Tokenを保存し、Bot Info APIで接続確認できます。Webhook署名検証と通知送信は、イベントの所属テナントに対応する設定を使います。DB設定がない間は既存の環境変数をフォールバックとして利用します。

## OpenAI

OpenAIはDream候補文の下書きだけに利用します。画面で接続を有効化し、各イベントのDream設定でもAIを有効化した場合に限り呼び出します。氏名等の直接識別情報や自由記述原文は送らず、接続失敗、形式不正、タイムアウト時は必ず固定文候補へ戻ります。既定モデルは `gpt-5.4-mini` です。

## 独自ドメインと監視

独自ドメインとHealthcheck URLを保存し、画面から到達確認できます。ドメインのDNSレコード追加とVercelへのドメイン割当はVercel側で別途実施します。監視ジョブは有効なテナントのHealthcheck URLだけを確認します。

## 定期通知

テナントの `notification_dispatch` は初期状態で無効です。管理画面で有効化するまで通知処理は行いません。CronのHTTP認証には `CRON_SECRET` を使用します。

現在のVercel Hobbyプランは1日1回を超えるCronを許可しないため、内蔵Cronは通知をUTC 00:00、監視をUTC 00:05の日次実行にしています。画面に保存する5分・10分間隔を本番運用へ反映するには、Vercel Proへ変更するか、同じ認証済みジョブURLを外部スケジューラから呼び出してください。

## 通知テンプレート

管理画面でテンプレートを保存するたびに新しい版を作成し、旧版を無効化します。結果通知は成立・不成立の各テンプレートを参照し、設定がない場合も固定文へフォールバックします。一方的な希望順位や非公開回答はテンプレートへ差し込みません。

## 本番前の確認

1. LINE接続確認と署名付きWebhook試験
2. OpenAI接続確認と固定文フォールバック試験
3. Vercelの独自ドメイン割当、DNS、TLS確認
4. Healthcheck監視結果の確認
5. テスト用イベントで通知プレビュー後、管理者承認の上で送信試験
6. 通知ジョブは送信試験直前まで無効を維持
