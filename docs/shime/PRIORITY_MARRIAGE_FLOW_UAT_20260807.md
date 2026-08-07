# 婚活最優先導線 合成UAT記録（2026-08-07）

## 目的と安全境界

2026-08-08の婚活イベントで使う「会話相手の選択から、結果公開後の72時間チャットまで」の導線を、production参加者データや実LINE通知を使わずに確認した。

- 基準release: `3964cd3188ef52a2408b6271978fe2fcd412d6b8`
- 検証ブランチ: `codex/priority-marriage-flow-final-integration`
- production設定変更: なし
- interaction memo本番ON: 未実施
- match chat本番ON: 未実施
- 実参加者・実通知: 未使用

## 今回追加した接続

立食形式で本人が登録した会話相手を、既存の最終希望入力の候補へ接続した。会話中に「もう少し話したい」をONにした相手は候補上部へ表示するが、選択済みにはせず、本人の確認・変更・最終送信を必須とする。既存の`mutual_up_to_2`、`first_choice_only`、`ranked_up_to_3`等の上限・順位・成立処理は変更していない。

候補APIは参加者番号と安全な状態だけを返し、氏名・ニックネーム・電話・メール・LINE ID・住所・相手からの希望・本人専用メモを返さない。

## 合成参加者相当の通し確認

| 手順 | 確認結果 | 根拠 |
|---|---|---|
| AがBの番号を検索しinteractionを確定 | 成功 | mobile interaction E2E、route/use-case test |
| Bのallowlist済みプロフィールだけ表示 | 成功 | public profile unit/route test |
| ワンタップタグ・お気に入り・120文字メモ保存 | 成功 | mobile E2E、unit、PGlite integration |
| `wants_to_talk_more` ON/OFF | 成功 | mobile E2E、unit、integration |
| BからAも同じ操作 | 成功（actor scope対称性） | actor固定・他actor非公開unit/integration |
| 最終希望候補へ引継ぎ | 成功 | 新規320px E2Eとunit test |
| 引継ぎだけでは希望未確定 | 成功 | E2Eで未選択・未送信を確認 |
| 本人が確認・選択・最終送信 | 成功 | preference handoff E2E、既存matching test |
| manager確定・結果公開・本人結果表示 | 成功 | 既存results/matching unit・E2E |
| 同一規約版へAのみ同意 | OPENしない | match-chat unit/API test |
| A/B双方同意 | OPEN | match-chat unit/E2E |
| A→B、B→Aの暗号化メッセージ | 成功 | match-chat unit/integration/mobile E2E |
| block・report・送信制限 | 成功 | match-chat unit/integration/E2E |
| 72時間・retention条件 | 成功 | match-chat unit/job test |

## 非公開・スコープ確認

- 他参加者のroomアクセス: 拒否
- cross-event/cross-tenant: API/UseCaseおよび複合FKで拒否
- 結果公開前・結果取消後・feature OFF・期限外: room OPENを拒否
- private memo: 相手用レスポンス、通常スタッフ集計、ログへ本文を出さない
- incoming `wants_to_talk_more`: 相手へ返さない
- 公開allowlist外プロフィール: 返さない。allowlistが空ならプロフィール値を公開しない
- チャット本文: AES-256-GCM、no-store、冪等送信、member scopeを維持

## モバイル確認

320pxで「相手番号 → プロフィール → 印象メモ → 自由メモ → もう少し話したい → 希望入力」の主導線を確認した。希望入力への直接リンクを追加し、保存後に管理トップへ戻す遷移は追加していない。新規E2Eでは横方向のはみ出しがないことも確認した。

全E2Eは47件成功・10件skipだった。既存のmatch chat mobileテスト1件だけが4 worker並列時に画面遷移待ちで失敗したが、同じテストを1 workerで再実行して成功した。重点5件の先行実行も成功しており、今回の導線コードによる再現性のある不具合ではない。

## 未実施・本番ONの停止条件

自動テストはスマホ2台相当の独立participant scopeを確認したが、実LINEアプリを使う物理端末2台での最終リハーサルは未実施である。次の項目が揃うまでmatch chatをONにしない。

- 正式な利用規約本文とversion
- 本文保持日数
- 通報対応責任者
- 隔離UAT完了、確認者、確認日時
- クライアントによる当日フローの実機確認

interaction memoも、対象イベントの公開プロフィールallowlist、タグ、利用時間、公開snapshotをクライアントが確認するまで本番ONにしない。

## 判定

- コード統合: **GO（Draft PRのCI・レビュー通過が条件）**
- production機能ON: **NO-GO（上記の正式設定と物理端末UATが未完了）**
