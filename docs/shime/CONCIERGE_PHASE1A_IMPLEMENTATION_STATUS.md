# Concierge Phase 1A 実装記録

更新日: 2026-07-23

## 結論

Concierge Phase 1Aのうち、管理画面での設定、カード画像の安全化、版管理、公開検証、イベントスナップショットまでを実装した。

参加者向け診断画面、回答保存、判定、外部AI接続、AI生成、AIジョブ、再試行、フォールバック処理は本Phaseでは実装・有効化していない。イベントへ適用したスナップショットの`enabled`は常に`false`で保存する。

## 実装済み

- tenant共通の診断テンプレート管理画面 `/admin/concierge`
- イベント別テンプレート適用画面 `/admin/events/{eventId}/concierge`
- 下書きでは不完全な設定を保存可能
- 公開時に4つの異なる分析軸と8つの有効な感情コードを検証
- 公開済みテンプレートを直接更新せず、変更は新versionとして作成
- カード画像、名称、メッセージを中立的なcard asset/versionとして管理
- 画像差し替えを新versionとして保存し、公開時に旧公開版をarchive
- カード追加、割当解除、並び替えを新しいtemplate version上で管理
- AIレポートのタイトル、見出し、固定文、免責文、案内文を保存・版管理
- 認証、権限、本人確認、個人情報、AI同意、システムエラーの表示は承認済みmessage keyの選択のみ
- 専用権限 `concierge:manage`、`concierge:publish`、`concierge:private-read`
- 公開テンプレート適用時に、テンプレート、カード文言、画像object key、hash、mappingをイベントスナップショットへ複製
- 全管理APIでtenant scopeを検証し、監査ログを保存

## 画像安全性

入力画像はサーバーで以下を検証する。

- JPEG、PNG、WebPの拡張子
- 宣言MIME type
- 実画像signatureと宣言MIMEの一致
- decode可否と破損
- 最大5MB
- 最低512×512px
- 最大8192×8192px
- 最大4000万pixel
- SHA-256 content hashとtenant内重複

正式保存前に自動回転後WebPへ再encodeする。EXIF等の入力metadataは引き継がない。保存先はprivate Supabase Storageとし、DBには恒久公開URLを保存しない。管理画面の確認画像は5分間の署名URLで表示する。

## DB変更

Migration: `0012_blue_serpent_society.sql`

- `concierge_card_assets`
- `concierge_card_asset_versions`
- `concierge_templates`
- `concierge_template_versions`
- `event_concierge_snapshots`
- enum `concierge_version_status`

Supabase Data APIの`anon`、`authenticated`には新規tableの権限を付与しない。

## 環境設定

Supabaseで非公開bucketを1つ作成し、VercelのPreviewとProductionへ次を追加する。

```text
SUPABASE_CONCIERGE_BUCKET=作成した非公開bucket名
```

既存の`SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`も必要である。bucketをpublicにしない。

## 未実装（次Phase以降）

### Phase 1B候補

- LIFF参加者向け導入、設問、カード選択、完了画面
- participant/event/tenant境界を持つ回答保存
- 決定論的な診断判定と結果表示
- 参加者向け認可画像配信
- 再開・二重送信・期限・イベント状態の制御

### Phase 2

- 外部AI Provider接続
- AI生成、非同期job、再試行、timeout、fallback
- AI利用同意と生成監査

## 未決事項

- 正式な4分析軸コードと設問
- 正式な8感情コード、名称、説明、画像
- 正式な画面文言、ボタン文言、AIレポート固定文
- participant向け診断の開始条件・再回答条件・期限
- 診断結果の確定ロジック
- private bucketの正式名称

未決の値は本番用として仮公開せず、管理画面の下書きで確定後に公開する。
