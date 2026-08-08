# SHIME LINE LIFF / アプリ内課金 調査・回帰確認記録

- 調査日: 2026-08-01（Asia/Tokyo）
- 対象: `team478a/shime`
- 対象ブランチ: `agent/liff-2.29.2-audit`
- 前提: 2026-08-08の必須導線に決済を含めない。本調査で課金機能は実装しない。

## 1. LIFF SDKのバージョンと読込方式

| 項目 | 確認結果 |
| --- | --- |
| 変更前 | `@line/liff ^2.29.1`（lockfileは`2.29.1`） |
| 変更後 | `@line/liff 2.29.2`（package/lockfileとも固定） |
| パッケージマネージャ | pnpm 11.7.0（npm registry利用） |
| 読込方式 | npm packageをClient Componentから`import liff from "@line/liff"`でbundle |
| CDN | 使用していない |
| 初期化 | `liff.init({ liffId })` |
| 未ログイン時 | `liff.login({ redirectUri: window.location.href })` |
| トークン取得 | `liff.getIDToken()`の生IDトークンをserverへ送信 |
| server検証 | LINE `POST /oauth2/v2.1/verify`に`id_token`とtenant設定の`client_id`を送信 |

npm registryで`@line/liff@2.29.2`の公開とintegrityを確認した。LINE公式リリースノートは調査時点で`2.29.1`の記載までであり、npm公開と文書更新に時間差がある。

## 2. LINE認証回帰の確認範囲

| 対象 | 自動回帰確認 | 安全性の確認 |
| --- | --- | --- |
| LINEログイン | LIFF URL生成、`liff.init`後の未ログイン分岐、現在URLを`redirectUri`に使う実装を確認 | `liffId` / `eventId`不足時は操作を開始しない |
| IDトークン | Fake Provider境界と実HTTP Providerのrequest/responseテスト | browser内のdecode結果を信頼せずLINE serverで検証。`sub`必須、期限切れ拒否 |
| 画面復帰 | 直接query、`liff.state`、path付きstate、tokenなし再入場、直接値優先をテスト | `eventId` / opaque `linkToken`を復元し、他の参加者データを返さない |

実LINEアプリ内でのログインと戻りは、自動テストでLINE本番認証を呼び出さない。PR取込み後に隔離UATイベントと合成参加者で、本人連携→Dream画面復帰を1回実機確認する。

## 3. LINEアプリ内課金の実装状況

### 実装済み

- なし。
- `@line/liff` 2.29.2の依存モジュールに`@liff/iap`は含まれるが、SHIMEのcodeは`liff.iap.*`を呼び出していない。これを課金実装済みと判定しない。
- IAP用商品、購入予約API、購入完了Webhook、付与transaction、返金同期は存在しない。

### 計画中

- Concierge Phase 5に、版付き商品、別同意、program membership、Payment Provider、署名検証、冪等Webhook、subscription stateが設計案としてある。
- Providerは未決定で、LINEアプリ内課金に限定した計画ではない。
- D-15〜D-18（商品名、価格、課金/解約/返金、Provider/account、特商法表示・窓口）と法務文書が未確定のため、Phase 5は未着手。

## 4. 決済対象の分類

LINE公式では、アプリ内課金はLINE MINI App内の「消費型デジタルコンテンツ」が対象である。下記は現時点の技術分類であり、最終判定はLY Corporationの審査と法務確認を優先する。

| SHIMEで想定する対価 | 分類 | 推奨決済境界 |
| --- | --- | --- |
| 婚活イベント参加料、現地の運営・席・会話サービス | 現実のサービス | 通常のWeb決済Provider候補。LINE IAPの消費型デジタル商品としては扱わない |
| 会場で渡す物販、飲食、印刷物 | 現実の商品 | 通常のWeb/店頭決済Provider候補 |
| 1回読み切りの診断レポート、デジタルカードパック | 消費型デジタルコンテンツ候補 | LINE MINI Appで販売する場合はLINE IAP審査対象候補 |
| 90日program、継続chat、サブスクリプション | 継続デジタルサービス、または混合 | 現行LINE IAPの「消費型のみ」とは別に設計・審査確認。現時点でIAP適合と断定しない |
| イベント参加+デジタルレポートのセット | 混合 | 対価を分離し、審査前にLINEと法務へ確認 |

## 5. 手数料率・規約同意日

| 記録項目 | 現在値 | 確認方法 |
| --- | --- | --- |
| IAP申請時の手数料率 | **未確認** | LINE Developers Consoleの対象LINE MINI App channel→「アプリ内課金」申請画面に表示された率を記録 |
| IAP規約同意日 | **未同意/未確認** | 同意操作時の日付、操作者、規約versionを承認記録に追記 |
| 無料期間終了 | 2026-06-30 | LINE公式告知 |
| 手数料適用開始 | 2026-07-01以降の決済 | LINE公式告知 |
| 改訂規約の予定施行日 | 2026-07-01 | 個別の「同意日」と混同しない |

公式文書は「申請時にConsoleへ表示された率が適用される」としているため、コードや公開ページから一律の率を推測しない。現在は課金申請を確認できる記録がないため、未確認とする。

## 6. 課金Webhookの安全性監査

| 確認項目 | Messaging API Webhook | IAP購入完了Webhook |
| --- | --- | --- |
| 受信route | 実装済み: `/api/webhooks/line` | **未実装** |
| tenant分離 | tenant code→tenant ID解決 | **未実装** |
| 署名検証 | `x-line-signature`のHMAC-SHA256、timing-safe比較 | **未実装** |
| 重複受信 | `(tenant_id, webhook_event_id)` unique + `onConflictDoNothing()` | **未実装** |
| 付与冪等性 | 該当する商品付与なし | **未実装** |
| 監査テスト | 不正署名拒否と冪等store境界をunit test | **未実装** |

IAP開始前の必須gate:

1. LINE IAP専用のWebhook routeとProvider interfaceを作る。
2. raw bodyの`x-line-signature`を付与より前に検証する。
3. `orderId`のDB UNIQUE制約とtransaction内の付与を使い、同じ購入の付与を1回に限る。
4. 同一Webhookを2回送る結合testで、付与回数が1回であることを検証する。
5. LINEが自動通知するため、SHIMEから重複の決済通知を送らない。
6. Webhook履歴APIによる受信漏れ復旧手順を作る。

IAPは現在未実装のため、重複・署名・付与冪等性を「合格」とは判定しない。これらは課金を有効化する前のP0であるが、2026-08-08の決済なし必須導線を妨げるP0ではない。

## 7. 公式参照

- [LIFF SDK release notes](https://developers.line.biz/en/docs/liff/release-notes/)
- [LINE MINI Appアプリ内課金の概要](https://developers.line.biz/ja/docs/line-mini-app/in-app-purchase/overview/)
- [LINE MINI Appアプリ内課金の組み込み](https://developers.line.biz/ja/docs/line-mini-app/in-app-purchase/implement-in-app-purchase/)
- [アプリ内課金 開発ガイドライン](https://developers.line.biz/ja/docs/line-mini-app/in-app-purchase/iap-guidelines/)
- [アプリ内課金の無料期間終了と規約改訂](https://developers.line.biz/ja/news/2026/02/19/line-mini-app-policy/)

## 8. 判定

- LIFF 2.29.2更新: **PR作成対象**
- LINEログイン・IDトークン・画面復帰: **自動回帰確認対象**
- LINE IAP: **未実装・未申請確認。有効化禁止**
- 手数料率・同意日: **Consoleの実表示と操作記録待ち**
- 2026-08-08本番必須導線: **決済なしの方針を維持**
