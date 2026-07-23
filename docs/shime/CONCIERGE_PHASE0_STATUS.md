# SHIME® 婚活AIコンシェルジュ Phase 0 進捗・未決事項

- 更新日: 2026-07-23
- 対象リポジトリ: `team478a/shime`
- 対象ブランチ: `main`
- 調査基準コミット: `174b2c32ff2aee00eb40ad6c31899c5242113a69`
- 対象: SHIME® 婚活AIコンシェルジュ 段階開発指示書 改訂版 v2.0
- 現在の段階: **Concierge Phase 0完了・Phase 1A未承認**

## 1. 現在の結論

Concierge Phase 0として、既存リポジトリ、DB、API、画面、権限、監査、AI、Storage、テスト、本番準備状況の調査を完了した。

次の2つの正式成果物を作成済みである。

1. `docs/shime/CONCIERGE_GAP_ANALYSIS.md`
2. `docs/shime/CONCIERGE_IMPLEMENTATION_PLAN.md`

C-01〜C-20は全件について回答または未確定部分を記録した。D-01〜D-18は、現在の回答、推奨案、未確定状態、決定者、Phase開始ゲートを整理した。

現時点では、コンシェルジュ機能のコード、DB、Migration、API、画面、外部接続、本番設定は変更していない。

## 2. 完了した作業

### 2.1 仕様確認

- 改訂版v2.0を確認
- 既存Event OS Phase 0〜8とConcierge Phase 0〜6を名称上分離
- 既存Source of Truth 6文書を確認
- 既存レビューのC-01〜C-20を改訂版へ反映
- Phase 0で禁止された実装作業を行っていないことを確認

### 2.2 リポジトリ調査

- Next.js、React、TypeScript、Drizzle、PostgreSQL/Supabase構成を確認
- DB schemaとMigration 0000〜0011を確認
- 管理者認証、LIFF本人認証、participant sessionを確認
- Dream、感情カード、席案内5問、Passport、受付、席配置、希望、結果、通知を確認
- tenant/event境界と既存permissionを確認
- audit log、operational log、PII非記録方針を確認
- LINE Provider、Dream AI Provider、固定文fallbackを確認
- Supabase Storageの現在の利用範囲を確認
- CI、Vercel Cron、unit・integration・E2E構成を確認

### 2.3 本番準備記録の確認

- 2026-08-08イベント設定状況を確認
- Phase 8本番準備判定を確認
- 2026-07-15以降の実機リハーサル記録を確認
- LINE/LIFF staging設定記録を確認
- Supabase backup・非本番復旧記録を確認
- Vercel staging配備方針を確認

### 2.4 作成した設計方針

- Dreamと診断でカード資産を共有し、利用設定・mapping・snapshot・回答を分離
- 席案内5問と診断4問を分離
- tenantとeventの二段階機能フラグ
- template、version、event snapshotの分離
- 診断、AIレポート、メモ、chat、programのmodule分離
- 診断原文を通常スタッフへ公開しない権限案
- AI入力からPIIを除外する許可リスト方式
- AI障害時の決定的な固定文fallback
- forward-only Migrationと機能フラグによる停止方針
- 320px、375px、390pxを対象とするスマートフォン優先方針

## 3. 確認できた既存基盤

| 基盤 | 状態 | Conciergeでの利用方針 |
| --- | --- | --- |
| 管理者認証・権限 | 実装済み | 専用permissionを追加して利用 |
| LIFF本人認証 | 実装済み | 既存sessionを利用 |
| tenant/event境界 | 実装済み | 全新規queryで強制 |
| Dream | 実装済み | 変更せず独立維持 |
| 席案内5問 | 実装済み | 診断4問と混在させない |
| SHIME® PASS | 実装済み | D-02確定まで完了条件を変更しない |
| 受付・席配置 | 実装済み | Concierge障害の影響を受けない |
| 希望・結果 | 実装済み | AIやメモで自動決定しない |
| 通知queue・再送 | 実装済み | 同意とdedupeを追加して利用 |
| audit log | 実装済み | 原文を記録せず操作事実だけ記録 |
| 版付きtemplate | 実装済み | 診断templateへ同じ原則を適用 |
| LINE Provider | 実装済み | 新機能から直接LINE APIを呼ばない |
| Dream AI Provider | 実装済み | Concierge Report Providerとは分離 |
| private Storage | 一部実装済み | 診断画像用Providerが別途必要 |

## 4. 未実装機能

以下はテスト未実施ではなく、機能自体が未実装である。

1. SHIME診断4問
2. 診断template、version、event snapshot
3. 診断用8感情カードと複合感情mapping
4. 診断回答の途中保存、提出、本人向け結果
5. AI本人レポート
6. AI同意、job、冪等性、利用上限、固定文fallback
7. ワンタップメモ
8. 24時間chat、block、report、moderation
9. 1週間後follow-up
10. 90日program
11. 商品・契約・決済連携
12. 診断画像のupload・private配信・版管理
13. tenant/eventのConcierge実行時機能ガード
14. 診断サポート専用permission

## 5. Conciergeの未決事項

### 5.0 Phase 1A追加確定要件

2026-07-23、次をPhase 1Aの確定要件として追加した。

- 画像差し替えは新しい画像asset・card versionとして作成し、旧版をarchive
- 公開済みcardの追加、削除、順序、文言、画像変更は新template versionで実施
- AIレポート表示設定はPhase 1Aで版管理し、外部AI処理はPhase 2まで実装しない
- 認証・権限・本人確認・個人情報・AI同意・system error文言は自由編集させない
- 実画像signature、decode、寸法、総pixel、hash、metadata除去、再encodeを含む画像検証
- draftは不完全保存可、publish時は4分析軸と8固定感情codeの完全性を強制

詳細は`CONCIERGE_PHASE1A_CONFIRMED_REQUIREMENTS.md`を参照する。

これらはPhase 1Aの受入条件を確定するが、D-01〜D-07の残りの意思決定やPhase 1A開始承認を代替しない。

### 5.1 Phase 1開始前に必要

| ID | 未決事項 | 現在の推奨 | 決定者 |
| --- | --- | --- | --- |
| D-01 | Phase 1〜3を2026-08-08本番で使うか | Event OS P0を優先し、受入未完了なら本番OFF | 事業・運営責任者 |
| D-02 | Dreamと診断の順序、必須／任意 | 別機能としてevent単位で設定 | Product責任者 |
| D-03 | 診断templateの所有・共有範囲 | tenant+module所有、event snapshot | Product・技術責任者 |
| D-04 | Dreamと診断のcard資産共有方法 | 画像・名称・メッセージ資産は共有し、用途別設定・snapshot・回答は分離。既存tableを意味変更しない物理schemaは設計レビューで確定 | 技術責任者 |
| D-05 | 8感情の正式表示label | 内部code固定、labelを版管理 | Client・監修者 |
| D-06 | 診断4問、選択肢、必須性、再編集 | 未確定値を実装へ仮置きしない | Client・監修者 |
| D-07 | 診断原文の閲覧権限と目的 | 専用権限、本人問い合わせ、理由・監査必須 | 個人情報管理責任者 |

D-01〜D-07が確定し、別途開始承認を受けるまでConcierge Phase 1Aへ進まない。

### 5.2 Phase 2開始前に必要

| ID | 未決事項 | 決定者 |
| --- | --- | --- |
| D-08 | AI同意文、privacy文書、保存・削除期間 | 法務・個人情報管理責任者 |
| D-09 | AI Provider、model、回数・token・金額上限 | 技術・事業責任者 |

### 5.3 Phase 3開始前に必要

| ID | 未決事項 | 決定者 |
| --- | --- | --- |
| D-10 | ワンタップメモの正式選択肢、自由記述、保存期間 | Client・運営責任者 |
| D-11 | メモを管理者が閲覧できるか | 個人情報管理責任者 |

### 5.4 Phase 4開始前に必要

| ID | 未決事項 | 決定者 |
| --- | --- | --- |
| D-12 | 24時間の起点、結果取消時の停止 | 運営責任者 |
| D-13 | chat規約、禁止事項、通報対応、保存・削除 | 法務・運営責任者 |
| D-14 | 1週間後通知の起点、対象、配信停止 | 運営責任者 |

### 5.5 Phase 5開始前に必要

| ID | 未決事項 | 決定者 |
| --- | --- | --- |
| D-15 | 「夢登録」「未来登録」等の正式名称 | Client |
| D-16 | 商品名、価格、無料期間、課金、解約、返金 | 事業責任者・法務 |
| D-17 | 決済事業者、本番account、3D Secure、運用担当 | 事業・経理・技術責任者 |
| D-18 | 特定商取引法表示、提供主体、問い合わせ窓口 | 法務・事業責任者 |

## 6. Event OS本番準備の残件

Concierge開発とは別に、2026-08-08本番へ向けたEvent OS側のP0が残っている。

1. 正式イベント情報、会場、規約、席マスターの確定
2. 本番LINE Login、LIFF、Messaging API、公式アカウント設定
3. 本番端末での本人連携と通知送信確認
4. 通知5分、監視10分のscheduler構築
5. 独自domain、監視、alert、本番Vercel/Supabase設定
6. 希望3方式、結果確定、公開、実通知、再送を含む全導線試験
7. 匿名化50名の本番相当リハーサル
8. 200名負荷、受付端末5台の同時試験
9. CSV・紙による代替運用訓練
10. 本番前backupと復旧確認

RH-A01では、実機LINE本人連携、Dream、5問、PASS、QR再発行、手動受付、取消、再受付まで確認済みである。ただし、これを全参加者・全シナリオの本番相当リハーサル完了とは扱わない。

## 7. リスクと優先順位

### P0

- Concierge追加で既存Dreamまたは席案内5問を壊す
- tenant/event境界を越えてprivate情報が漏れる
- 診断原文、希望、メモ、chatが通常スタッフや他参加者へ見える
- 新機能開発が2026-08-08本番準備を遅らせる
- 未承認のConcierge機能が本番で有効になる

### P1

- AIへPIIや自由記述を過剰送信する
- AI jobの重複実行・重複課金
- 機能フラグがUI非表示だけでAPIを止めない
- 診断画像のURL漏えいまたは過去version破損
- chat通報へ対応できない

### P2

- 婚活固有文言を共通OSへhardcodeする
- 管理画面の操作数が増え、現地スマートフォン運用が重くなる
- template管理や集計画面の操作性不足

## 8. 検証結果

Phase 0成果物作成後に次を実行した。

| 確認 | 結果 |
| --- | --- |
| `pnpm lint` | 合格 |
| `pnpm typecheck` | 合格 |
| `pnpm audit:dependencies` | 既知の脆弱性なし |
| `pnpm test:unit` | 47 files、166 tests合格 |
| `pnpm test:integration` | 1 file、2 tests合格 |
| `pnpm build` | production build成功 |
| `pnpm test:e2e` | 25件合格、1件skip |
| `git diff --check` | 合格 |
| C-ID確認 | C-01〜C-20、20件確認 |
| D-ID確認 | D-01〜D-18、18件確認 |

## 9. GitHub・配備状況

- Phase 0成果物と本進捗記録はコミット`8ef9c38`でGitHub `main`へpush済み
- CI修正はコミット`8d32444`でpush済み
- GitHub Actions `verify`と`e2e`は成功
- Phase 0進捗MarkdownはVercel stagingの公開ダウンロードURLでHTTP 200を確認済み
- 今回追加したPhase 1A確定要件は、この更新時点ではローカル文書変更
- Supabase、LINE、OpenAI、本番環境は変更していない

## 10. 次に行う順序

1. 本進捗記録、差分調査、実装計画を責任者が確認
2. D-01を最優先で決定
3. D-02〜D-07を決定
4. Event OS本番P0の担当・期限とConcierge作業枠を分離
5. Phase 1Aの変更予定を再確認
6. 別指示によるPhase 1A開始承認
7. Phase 1Aだけを実装・検証

## 11. 現在の停止点

**Concierge Phase 0は完了した。Concierge Phase 1Aは未承認であり、D-01〜D-03およびD-05〜D-07が未確定のため、実装へ進まず停止する。**

現時点で安全に進められるのは、文書レビュー、未決事項の意思決定、Event OS本番P0の解消である。
