# 会話メモ設定 staging UAT記録

実施日時: 2026-08-07（Asia/Tokyo）  
対象: Vercel `shime-staging` / Supabase staging  
対象外: production

## 承認と安全条件

利用者の明示承認に基づき、PR #23のアプリケーションをstagingへ配備し、合成イベントだけで会話メモ設定の版管理UATを実施した。

- 実参加者データは使用していない。
- LINE通知、参加者メモ、マッチ結果は作成していない。
- production、release、mainは変更していない。
- UAT終了時に公開中の会話メモ設定を0件へ戻した。

## デプロイ

- Vercel project: `shime-staging`
- deployment ID: `dpl_54tq57UaTwpBvapZWmRQMjLK4mYL`
- deployment URL: `https://shime-staging-edl2ktskc-stockbusinessjp-gmailcoms-projects.vercel.app`
- alias: `https://shime-staging.vercel.app`
- status: Ready
- `/api/health`: 200
- `/admin/login`: 200
- staging警告と「本番データを入力しない」表示: 確認済み

Vercel projectのProduction環境には必要な19変数が登録されている。CLIのenv pullでは暗号化済み値を取得できなかったため、取得値をローカルビルドへ渡さず、Vercel側の保存済み環境変数を使用するリモートビルドで配備した。値確認用の一時ファイルは削除した。

## 合成データUAT

使用イベント:

- event ID: `5142b5f1-d9c5-4517-aea7-07bf6046705c`
- event code: `rh-c-20260715`
- event name: `[検証専用] SHIME RH-C`
- event status: `draft`

結果:

| 操作 | 結果 |
| --- | --- |
| 管理者ログイン | 200 |
| 初期一覧取得 | 200、既存snapshot 0件 |
| version 1下書き作成 | 201 |
| version 1公開 | 200 |
| version 2下書き作成 | 201 |
| version 2公開 | 200 |
| 新版公開時の旧版自動停止 | 成功 |
| 同時公開版1件制約 | 成功 |
| version 2停止 | 200 |
| 終了時の公開版 | 0件 |
| 認証済み管理画面 | 200、見出し表示確認 |
| 未認証API | 401 |

下書きには合成ラベルだけを使用し、公開プロフィールallowlistは`nickname`と`hobbies`だけに限定した。作成したversion 1、2はいずれも停止状態で履歴として残る。

## 追加の権限・モバイル確認

- 合成スタッフを一時作成し、対象権限を持たない認証済みセッションから一覧APIへアクセスすると`403 FORBIDDEN`になることを確認した。確認後、そのスタッフを無効化した。
- 390×844pxの認証済みスマートフォン表示で、会話メモ設定、新しい下書きフォーム、版の履歴、停止済みversion 1・2を確認した。画面幅390pxに対してdocument scroll widthは375pxで、横スクロールは発生しなかった。
- モバイル確認用に作成した合成スタッフは確認直後に無効化した。参加者データ、LINE通知、公開snapshotは作成していない。

## UAT所見

- 存在しないevent IDで一覧APIを呼ぶと、初回配備では404ではなく空一覧の200を返した。データ漏えいはなかった。後続修正でRepositoryへ同一tenantのイベント存在確認を追加し、UseCaseがsnapshot検索前に`EVENT_NOT_FOUND`を返すよう統一した。重点5テスト、型、architecture、lint、全テスト、buildは成功した。
- 修正版commit `57e51a7`をdeployment `dpl_HBg5HDbK58K5QPMDSq9cXRtE2wWe`としてstagingへ再配備した。health 200、既知イベント200、未知イベント`404 EVENT_NOT_FOUND`、未認証401、公開中snapshot 0件を実APIで確認した。

## 判定

会話メモ設定の作成・公開・新版切替・停止という主要ライフサイクルはstagingで成功した。featureは終了時にOFF相当（公開版0件）であり、本番イベントには影響していない。

PR #23は、権限不足セッション、認証済みモバイル表示、主要ライフサイクル、scope拒否をstagingで確認済みである。最新HEADのGitHub Actions結果を確認してからreleaseへのマージ判断を行う。
