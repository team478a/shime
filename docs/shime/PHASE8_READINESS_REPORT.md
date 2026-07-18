# Phase 8 本番準備判定

判定日: 2026-07-14  
本番日: 2026-08-08  
判定: **本番可能ではない（P0残件あり）**

## 今回確認できた項目

- 2026-07-15、UI品質改善、リハーサル資料、合成12名CSVをVercel stagingへ反映（`dpl_FPkBUkbSED8dRzxeTkKFbuaqCS8D`）。aliasは `https://shime-staging.vercel.app`。公開health 200、認証付きreadiness 200、未認証の管理・ジョブAPI 401、system_adminログインとログアウト、LINE Bot Info 200、Webhook正署名 200・不正署名 401、公開資料のSHA-256一致を確認
- 2026-07-15、Supabaseの52 public tables、migration 10/10、runtime/migration接続先一致、private Storage bucket、daily backupモード、バックアップリハーサル準備状態に問題なしを確認
- 2026-07-17、運営OSの共通基盤として版付き `resource_templates` を追加し、stagingの53 public tables、migration 11、runtime/migration接続先一致を確認。会場レイアウトはテナント共通テンプレートからイベント固有席マスターへコピーし、テンプレート更新が進行中イベントへ波及しない構成とした
- 2026-07-17、会場テンプレート管理画面、全版履歴、座席プレビュー、イベント適用履歴、理由付きアーカイブ、保存成功時スナップショット記録を実装。Supabase stagingの54 public tables、migration 12、runtime/migration接続先一致を確認
- 2026-07-17、上記テンプレート管理をVercel stagingへ反映（`dpl_5e24i3BZPceGmt6ARH7TVL6JBnCz`）。公開health 200、未認証管理画面307、未認証テンプレートAPI 401を確認
- 2026-07-17、スマートフォン実機でRH-Aの合成席構成から同名テンプレートv1・v2を作成し、v2を理由付きアーカイブ。再作成時に別系列となるP1を検出し、履歴版から同じキーの次版を作る操作とコピー元名の自動再利用を実装。再試験では同じ系列のv3作成とRH-Bへのコピー・保存に成功し、DBでv1・v2無効、v3有効、適用版3、snapshot schema v1・2卓、SHA-256長64を確認してP1を解消
- 2026-07-17、適用済みの同テンプレートv3を理由付きでアーカイブし、RH-Bの2卓・4席、適用版3、最終スナップショット、SHA-256、適用履歴1件が保持されることと、理由付き監査ログをDB確認。会場テンプレートの作成・復元・イベント適用・アーカイブ保持リハーサルを完了
- 2026-07-15、実機リハーサル用の実行記録、P0/P1/P2判定表、合成12名CSVを作成。CSVは3つの隔離シナリオと4名ずつ、参加区分が均等で、全12行が取込検証に合格することを自動テストで確認。これは準備完了の記録であり、実機リハーサル実施済みの記録ではない
- 2026-07-15、CSV確定後に参加者レコードが作成されないP0を修正しstagingへ反映。RH-A/B/Cの隔離イベントを作成し、各4件の合成申込を取込・参加確定した。申込12件、参加者12件、イベント境界不整合0件、設定処理再実行時の増分0件を確認
- 2026-07-15、RH-A/B/Cへ各テーブル2卓・有効席4席、感情カード8枚、席案内5問、公開規約2文書を登録し、全イベントの設定不足0件を確認。参加者番号設定の互換性不足と乱数衝突リスクを解消し、イベント単位の直列・決定論的採番へ変更
- lint、TypeScript、単体テスト、DBマイグレーション統合テスト、production build
- Chromiumによるデスクトップ／スマートフォンのスモークE2E
- 未認証管理画面のリダイレクトと管理API拒否
- 参加者主要画面の320〜430px相当での横スクロール有無
- CSVのUTF-8 BOM、引用符、スプレッドシート数式インジェクション防止
- 通常CSVと一方希望を含む責任者限定CSVの権限分離
- 非本番環境バナー
- Proプランの日次physical backup、リポジトリ外ロジカルバックアップ、ローカル復元、クラウド非本番復元
- クラウド復旧先との47 public tables、総行数16、8 migrations、全テーブル別件数SHA-256一致
- private Storageへの匿名fixture復元・再取得・SHA-256一致
- クラウド復旧先を参照した管理者ログインと管理イベントAPI
- Vercel stagingで管理者ログイン、セッション発行、管理イベントAPI、管理画面、新規イベント画面、ログアウト
- staging新規イベント画面で正式イベント名、日時、会場、夢登録方式、希望方式、参加区分、席替え、カード、保存期間、規約の管理設定項目
- VercelへLINE／LIFF環境変数4件をSensitive登録し、2026-07-14にstagingを再デプロイ
- stagingで公開health 200、認証付きreadiness 200、LIFF IDのビルド反映、LINE Webhookの正署名200・不正署名401
- LINE Messaging APIの現行チャネルアクセストークンに差し替え、LINE Bot Info API 200を確認後にstagingを再デプロイ（`dpl_J16vdxyLeaAzjdXaBPu8gYf4RhjJ`）
- 外部接続・運用設定、暗号化済みLINE/OpenAI設定、監視、通知ジョブ、通知テンプレートを追加し、2026-07-14にstagingへ再デプロイ
- OpenAI Models API 200、公開health 200、管理APIとジョブURLの未認証401を確認
- 管理APIからOpenAIを有効化し、接続状態 `healthy` を確認。JSON Schema制約付きの匿名合成Dream入力で橋渡し文1件・候補3件を実生成
- OpenAI出力形式修正版をstagingへデプロイ（`dpl_9xwiv56uJYmwdQfcxwaTV8bcarsH`）。再デプロイ後にhealth 200、Dream API未認証401、OpenAI設定維持を確認
- 2026-08-08イベントをstagingへ下書き作成し、標準申込項目8件を登録。運用リソースを含む受付開始ガードをデプロイ（`dpl_unhzrSWx5zbQHNaJZ4DD1JiD6TaM`）
- 未完了18件の状態で受付開始が409拒否され、イベントが `draft` のまま維持されることを確認
- Dream設定保存時のカードセットコード同期をstagingへデプロイ（`dpl_3UrgWAcTJvzJ7E4dfTJXqmV6wfwp`）
- 暫定感情カード8枚、AI＋固定文フォールバック、席案内5問v1を登録。設定未完了判定は15件へ減少
- 未確定項目を一元管理するイベント設定チェック画面をstagingへデプロイ（`dpl_8qiaMxt5Yp9qUR24FqW2GFB9nDd9`）。認証済み200と未確定15件の表示を確認
- 再デプロイ後にhealth、readiness、管理者ログイン／イベント一覧／ログアウト、Webhook署名検証を再確認
- 管理機能拡張第1弾（管理者・権限、安全条件付き下書きイベント削除、テーブル・席、申込項目）をstagingへデプロイ（`dpl_9AMRgyZbQPD7hVasByCSJ2urngTr`）
- デプロイ後にhealth、管理者ログイン、管理者・権限画面／API、イベント一覧、ログアウトをデータ変更なしで確認
- LINE管理設定を参加申込・本人連携画面へ実行時反映し、管理画面にLIFF起動URL、Endpoint URL、テナント指定付きWebhook URLを表示するよう改善
- 上記LINE設定改善をstagingへデプロイ（`dpl_GL5jjSg2Ctw7c1Cbs4wdXoNkyZWp`）。管理API・LINE接続・health・LIFF画面200、正署名Webhook 200、不正署名401、テナント未指定400を確認
- SHIMEプロバイダーにLINEログインチャネルとLIFFアプリを作成し、既存公式アカウントを連携。Webhook、LIFF Endpoint、`openid`、通常の友だち追加、管理画面のチャネルID／LIFF IDを設定
- LIFF一次リダイレクトの `liff.state` と二次リダイレクトの直接クエリの両方に対応し、stagingへデプロイ（`dpl_DkNth5zoHtivgQykKRUrQFypdy92`）。隔離したリハーサルイベントに合成申込1件と72時間QRを準備
- 規約・プライバシーのイベント別版管理、下書き、公開、過去版保存、公開ページ、申込同意導線、受付開始ガードを追加。正式文面は未確定のため未登録
- 規約管理をSupabaseとstagingへ反映（`dpl_3u11RZ7PfbpAJRYpFMLv4dBNsEWe`）。health 200、未認証管理API 401、未公開規約 404、未認証管理画面 307を確認
- スマートフォン向けに、LINE本人連携ボタン、リンクコピー、別画面表示、受付QRの480 px化、画像表示・保存、受付コードコピー、手動受付案内を追加しstagingへ反映（`dpl_GFiwM6SHUgTRxe1bzUo4nC4SuFhq`）。health 200、LIFF Passport 200、未認証QR API 401を確認
- 管理者限定の参加者LINE連携状況画面と72時間リンク再発行を追加しstagingへ反映（`dpl_9QMZoQ6YZp3XJmNKzFfosUmQ8bSS`）。旧URL失効、ハッシュ保存、生トークン非ログ、連携済み再発行拒否、未認証管理画面 307、未認証API 401を確認

## P0

1. `EVENT_CONFIG_20260808.yaml` の `REQUIRED_INPUT` が未確定
   - 正式イベント名、終了日時、会場、申込期間、希望期間、参加区分、席替え回数、カードセット、保存期間、規約版
   - staging管理画面から下書き作成・編集・不足項目確認が可能。必須設定完了前は受付開始を拒否する
2. 本番LINE／LIFF未構築
   - stagingのWebhook登録、LINEログインチャネル、LIFFアプリ、公式アカウント連携、LIFF ID反映、Webhook署名検証、Messaging API channel access tokenのLINE Bot Info API 200は確認済み。LINE設定は管理画面から保存・接続確認できる
   - LINE Login IDトークン、実端末での本人紐付け、通知送信は未検証
3. 高頻度Cron未構築
   - 現在のVercel Hobbyプランでは内蔵Cronが日次実行に限定される
   - 本番前にVercel Proまたは外部スケジューラで通知5分・監視10分の呼び出しを構成する
4. 本番相当の認証済み全導線E2Eが未実施
   - 新規／既存Dream、必須／任意、QR／手動受付、欠席後再配置、希望3方式、結果通知
   - Vercel stagingの管理者認証、管理API、および3つの検証専用イベント作成・CSV取込・参加者作成までは確認済み。実端末での本人連携以降は未実施
5. 本番運用デプロイが未完了
   - Vercel staging、Sensitive環境変数、HTTPS、Supabase接続、health／readiness、未認証API拒否は確認済み
   - 独自ドメイン、ジョブ実行、監視・アラート、本番環境への昇格が未確認

P0が1件でも残る間は本番可能と判定しない。

## P1

- 匿名化した50名の本番リハーサル
- 200名の負荷試験と受付端末5台の同時試験
- LINE通知失敗・再送の実サービス試験
- CSV／紙による受付・席表の代替訓練
- 管理者MFAの採用判断

## P2

- 質問票の構造化GUIエディター
- 席配置のドラッグ操作
- 高度な運用分析表示

## P0解消順

1. 主催者がイベント確定値を記入
2. 正式設定でstagingイベントを作成し、認証済み全導線を検証
3. LINE／LIFFをstagingへ接続
4. 匿名化50名で全導線リハーサル
5. 修正後、productionへ同じマイグレーションを適用
