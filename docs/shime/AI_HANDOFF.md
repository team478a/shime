# SHIME AI引継ぎ記録

## 現在の状態（唯一の最新状態。これ以外の記述は本セクションで上書きされる過去の記録）

最終更新: 2026-08-07（Asia/Tokyo、Codex。婚活最優先導線の最終統合・検証）
作業ブランチ: `codex/priority-marriage-flow-final-integration`
コミュニケーション匿名集計PR: `#26`（releaseへマージ済み）
マッチ後チャット運用管理PR: `#25`（releaseへマージ済み）
会話メモ設定PR: `#23`（releaseへマージ済み）
マッチ後チャット安全基盤PR: `#24`（releaseへマージ済み）
release install hotfix PR: `#27`（releaseへマージ済み）
release HEAD / production deployment source HEAD: `3964cd3188ef52a2408b6271978fe2fcd412d6b8`
PR #3最終HEAD: `3fb7c64b0bb1e99bf745242b67ddf39fcdcf08c0`
release merge commit: `cef5ace36768b2af82e4dc47cdf91d250d9fbdc5`
PR #4 merge commit: `a40e0a64cab3b084ec8cd787bbc3831bc0ded940`
PR #6 merge commit: `7f5440979efe4e23077fd9c7dbe10d3349db0172`
PR #7 merge commit: `7a616a9`
PR #10 merge commit: `e621ae3`（レビュー修正commit `e299369`は含まない）
PR #13 merge commit: `d53df09274dd0a27e4b1aac24681a85bf9c9a50d`
PR #14 merge commit: `9c98cf54ccd589af04417ae5f74c2ad3e9d0093d`
PR #15 merge commit: `c7d9b5c81fde23b03e83bb400ad2c27f190d674a`
release HEAD（本番反映済み）: `3964cd3188ef52a2408b6271978fe2fcd412d6b8`
最新文書コミット: 本更新を含むコミット（コミット自身のSHAは文書内へ自己参照しない）
開始時の `main`: `b07d1ce`

### 婚活最優先導線の最終統合（2026-08-07、実装・検証済み、Draft PR #32）

- 最新`release/2026-08-08-readiness`の`3964cd3188ef52a2408b6271978fe2fcd412d6b8`から`codex/priority-marriage-flow-final-integration`を作成した。PR #19/#20/#23/#24/#25/#29の既存機能を再利用し、別システムは作っていない。
- 立食イベントのself-reported interactionを既存の最終希望候補へ接続した。本人が`wants_to_talk_more`をONにした相手は候補上部へ表示するが、自動選択・自動送信・自動成立は行わない。本人が最後に確認・変更して送信する。
- 希望候補は参加者番号だけを返し、氏名・ニックネーム等を無条件に公開しない。自分自身、回避対象、未受付、別tenant/event/serviceは既存境界と追加UseCaseで除外する。相手側の`wants_to_talk_more`やprivate memoは取得・表示しない。
- interaction画面に最終希望入力への直接導線を追加した。プロフィールは既存allowlistを維持し、allowlistが空なら値を公開しない。タグ、お気に入り、120文字本人専用メモ、revision conflict、冪等保存も既存実装を維持する。
- migration追加は不要。productionはmigration 25/25で、match chat設定・room・messageが0件かつ機能OFFであることを既存production適用記録で確認した。今回、production設定変更、機能ON、実参加者データ操作、LINE通知、deployは行っていない。
- production deploymentは`dpl_5gA2v5rUVBjTMJRT3GHVBiBBoJY8`（Ready、`https://app.shimelife.jp`）で、deployment sourceはrelease `3964cd3188ef52a2408b6271978fe2fcd412d6b8`である。
- productionイベントのinteraction memo実行時設定は管理セッション切れにより再取得できなかった。fail-closed設計と未変更は確認済みだが、公開snapshot/allowlist/利用時間は本番ON前に管理画面で再確認する。
- 検証記録は`PRIORITY_MARRIAGE_FLOW_UAT_20260807.md`。architecture、lint、typecheck、単体82ファイル417件、結合6ファイル50件、production build、重点mobile E2E 5件、依存監査は成功。全E2Eは47件成功・10件skip・既存match chat mobile 1件が4 worker並列時に一時失敗し、同じテストの1 worker再実行は成功した。
- `readiness`は実行成功だが正式イベント情報14項目が未確定でproduction readyはfalse。`readiness:strict`も同じ14項目で失敗し、今回のコード不具合とは分離する。
- コード統合はDraft PRのCI/レビュー通過を条件にGO。本番interaction memo/match chat ONは、正式チャット規約、保持期間、通報責任者、隔離UAT確認者・日時、クライアント実機確認が未完了のためNO-GO。

### マッチ後チャット有効化ゲート強化（2026-08-07、実装・検証済み、未適用）

- PR: `#29`（`codex/match-chat-uat-gate` → `release/2026-08-08-readiness`）。CI成功、レビュー可能、未マージ。
- production配備後の再確認で、従来は規約の版番号だけで機能ONにでき、参加者の同意画面に正式な規約本文が表示されない不足を検出した。通報対応責任者と合成データUATの完了記録も設定に存在しなかった。
- `event_match_chat_configs`へ正式規約本文、通報対応責任者、UAT確認・確認者・確認日時を追加するmigration 0024を作成した。既存の有効行がある環境では、移行時に設定を削除せず機能だけをOFFへ戻すfail-closed方式とした。
- 規約版、規約本文、本文保持日数、通報対応責任者、UAT確認がすべて揃わない限り、ZodとDB CHECKの両方で機能ONを拒否する。UAT確認者は認証済み操作ユーザーとtenant複合FKで拘束し、日時はサーバー側で記録する。
- 再レビューで、UAT確認済みのまま規約・保持期間・利用時間・送信制限・通報責任者を変更できる問題を検出し、先に機能とUAT確認をOFFにしない限り変更を拒否するよう補強した。変更後は再UATが必要となる。監査ログには規約本文そのものを複製せず、設定有無と文字数だけを残す。
- 参加者の同意画面には、サーバー設定から取得した正式規約本文を全文確認できる開閉表示を追加した。規約内容は開発側で作成・推測しない。
- 手順と中止条件は`MATCH_CHAT_ACTIVATION_GATE_20260807.md`へ記録した。
- 検証: architecture成功（DB直接route `61/62`、client fetch `23/24`、巨大component `9/9`）、lintエラー0（既存warningのみ）、typecheck成功、単体82ファイル415件、結合6ファイル50件、production build成功、依存監査は既知脆弱性0件。チャット重点テスト27件とmobile E2E 1件が成功した。全E2Eは46件成功・9件skipで、既存manual表示1件だけが並列実行時に一時失敗し、単独再実行で成功した。
- `readiness`はコマンド成功だが正式イベント情報14項目が未確定のためproduction readyはfalse。`readiness:strict`は同じ14項目で失敗しており、今回のコード変更とは別の本番P0である。
- migration 0024はどの環境にも未適用。ブランチは`codex/match-chat-uat-gate`で、production deploy、機能ON、実データ操作、LINE通知は行っていない。

### 2026-08-07 production rollout（migration 0021〜0023・release 9b4e42e）

- 積み上げPR #23、#24、#25、#26を順に`release/2026-08-08-readiness`へ通常マージした。統合後、`js-yaml` overrideがworkspace設定とlockfileで重複して依存インストール不能になる問題を事前検査で検出した。本番DB変更前に停止し、重複各1行だけを削除するPR #27を作成した。
- PR #27はfrozen lockfile install、format、architecture、lint、typecheck、dependency audit、単体82ファイル414件、結合6ファイル50件、production buildに成功した。GitHub Actionsの`verify`と`e2e`も成功後、releaseへマージした。
- production Supabaseは`dipcpqmbmumazyuorslv`であることを接続前に確認した。事前点検はmigration 21/24、public table 70、private import bucket有効・object 0件、backup mode `daily`だった。件数差3件は今回適用対象の0021〜0023と一致した。
- 2026-08-07 09:52 JST、リポジトリ外の所有者限定フォルダへ最終ロジカルバックアップを取得した。`roles.sql` 370 bytes、`schema.sql` 128,858 bytes、`data.sql` 164,443 bytesで、すべて非0 byteかつSHA-256算出済み。SQL本文、資格情報、絶対保存先は共有記録へ含めない。Storage objectは0件のため追加同期対象はなかった。
- 2026-08-07 09:54:28〜09:54:32 JST、migration `0021_rapid_falcon.sql`、`0022_low_typhoid_mary.sql`、`0023_lumpy_wallop.sql`をproductionへ適用した。適用後はmigration 24/24、public table 76、backup readiness issue 0件となった。
- postflightで会話メモlifecycle制約、match chatの6テーブル、主要tenant/event複合FK、unique indexを確認した。`event_match_chat_configs`、`match_chat_rooms`、`match_chat_messages`はいずれも0件で、match chatはOFFの安全状態を維持している。
- release `9b4e42e`をVercel production deployment `dpl_4BMB7jr5Moz6KoexmdmunBtGMrBT`へ配備し、`https://app.shimelife.jp`へaliasした。Vercel statusはReady、`/api/health` 200、`/liff/chat` 200、未認証`/admin` 307、未認証`/api/jobs/match-chat-retention` 401を確認した。
- migration適用とデプロイだけを行い、match chat設定ON、会話メモ新版公開、実参加者データ操作、LINE通知送信は行っていない。正式チャット規約版、本文保存期間、通報対応責任者・運用手順、合成データUATが確定・完了するまでmatch chatをONにしない。

### Phase 4E コミュニケーション匿名集計（2026-08-07、実装・検証済み、未公開）

- `packages/operations-analytics`を新設し、会話メモとマッチ後チャットを1つの読み取り専用運営ダッシュボードへまとめた。管理画面は「当日運営 > コミュニケーション匿名集計」から開き、`operations:read`権限だけを要求する。
- 集計Repositoryはtenant/event/serviceをすべてWHERE/JOIN条件へ含める。会話メモは件数・お気に入り・「もう一度話したい」・気持ちコード別件数、チャットはroom状態・本文件数・通報状態別件数だけをSQLで集計する。参加者ID、参加者番号、氏名、本人専用メモ本文、暗号化チャット本文、通報補足、希望順位、Dream、感情回答はSELECTおよびDTOへ含めない。
- 固定の匿名化境界として、対象者5名未満のセクション全体を非表示、個別セル1〜2件を非表示とする。小セルを総件数との差から逆算できないよう、気持ちコード別に非表示セルがある場合はメモ総数、通報状態別に非表示セルがある場合は通報総数も非表示とする。0件と3件以上だけを表示する。
- APIは`staffEventHandler`、UseCase、Repositoryの順で分離し、成功レスポンスは`{ data }`、キャッシュは`no-store`。event限定スタッフが別eventを指定した場合と権限不足を403、同一tenant内に存在しないeventを404で拒否する。画面は横表を使わずカード表示とし、スマートフォンでも縦方向だけで確認できる。
- DB列・テーブルは追加しておらず、新規migrationは不要。既存migration 0022/0023は引き続き未適用で、staging/productionへの適用、デプロイ、チャット機能ON、実データ操作、LINE通知は実施していない。
- 検証: architecture成功（DB直接route `61/62`、client fetch `23/24`、巨大component `9/9`）、lintエラー0（既存warningのみ）、typecheck成功、単体82ファイル414件、結合6ファイル50件、production build成功、依存監査は既知脆弱性0件。重点テストは匿名化・レスポンス非公開・API権限/scope 8件と、PGlite実DB相当のcross-tenant/event集計1件が成功した。
- 全E2Eは46件成功・9件skip・既存manual表示1件が並列実行時に一時失敗した。該当mobile manual 4件を1 workerで再実行して全件成功し、今回の機能と無関係な並列表示揺れと判定した。`readiness`はコマンド成功だが正式イベント情報14項目未確定のためproduction readyはfalse、`readiness:strict`も同じ14件で失敗した。
- PR #26の独立レビューでGitHub Actions `verify` / `e2e`の成功、未解決レビュースレッドなしを確認した。結合テストを「別tenant」に加え「同tenantの別event」と「同tenant/eventの別service」のノイズで補強し、3スコープがそれぞれ独立して集計から除外されることを実DB相当で再確認した。画面の匿名化閾値文言もAPIが返す設定値に追従させ、実装と表示の乖離を防止した。レビュー時点で新たなP0/P1コード不具合はない。
- 次は積み上げPR #23→#24→#25→#26のベース関係と各CIを最終確認し、許可を得て順番にマージする。その後も、0022/0023適用、合成データによるstaging UAT、正式チャット規約・本文保存期間・通報対応責任者の確定が完了するまで、マッチ後チャットと匿名集計を本番公開しない。

### マッチ成立後チャット Phase 4D 運用管理（2026-08-07、実装・検証済み、未公開）

- イベント管理画面に「マッチ後チャット」を追加し、機能ON/OFF、利用時間、1分当たり送信上限、本文文字数、保存日数、規約版をイベント単位で設定できるようにした。初期状態は必ずOFFで、規約版または保存日数が未設定の状態ではONにできない。
- 通報対応一覧では、対象者を参加者番号だけで表示し、通報区分、任意補足、状態、受付日時を確認できる。本文メッセージ、相手の希望順位、Dream、感情回答、個人連絡先は管理APIと画面へ返さない。「確認中」「対応済み」への一方向状態遷移を実装し、対応操作をtenant/event/reportで拘束した。
- 管理APIは`staffHandler`、UseCase、Repository契約、Drizzle実装へ分離し、既存の`event:write`権限で保護した。設定変更と通報状態変更は監査ログへID・版・状態などの運用メタデータだけを記録し、通報補足やチャット本文を複製しない。
- 期限切れまたは論理削除済みの暗号化メッセージを、tenant/event境界を維持して最大5000件ずつ物理削除する内部jobを追加した。Vercel cronは毎日00:15 UTC（09:15 JST）で、既存の`INTERNAL_JOB_SECRET`/`CRON_SECRET`認証を利用する。jobログは削除件数とrequest IDだけで、本文・参加者情報を含まない。
- migration 0022に通報状態・担当者、0023に本文保存期限・削除日時が既に存在するため、新規migrationは不要。0022/0023は未適用のままで、staging/productionへの適用、デプロイ、機能ON、実データ操作、LINE通知は実施していない。
- 検証: architecture成功（DB直接route `61/62`、client fetch `23/24`、巨大component `9/9`）、lintエラー0（既存warningのみ）、typecheck成功、単体81ファイル408件、結合5ファイル49件、production build成功、依存監査は既知脆弱性0件。管理UseCase・API・DB scopeの重点26件も成功した。並列E2Eではマッチ後チャット1件が一時失敗したが、全E2Eを直列再実行して47件成功・9件skipとなった。
- 全体`format:check`はWindows CRLF差による既存471ファイルで失敗。今回変更ファイルの個別Prettier、対象ESLint、`git diff --check`は成功した。`readiness`コマンド自体は成功したが、production readyは正式イベント情報14項目未確定のためfalse。`readiness:strict`も同じ14件の`REQUIRED_INPUT`で失敗し、今回のコード不具合とは分離する。
- 次はPR #25の独立レビュー、GitHub Actions確認、正式チャット規約・保存期間・通報対応責任者と手順の確定、合成データによるstaging UATである。匿名集計ダッシュボードと参加者通知は、本文や個人情報を集計へ混入させない別モジュール・別PRとして扱う。これらの運用準備とmigration適用判断が完了するまで機能をONにしない。

### マッチ成立後チャット Phase 4C 参加者UI（2026-08-07、実装・検証済み、未公開）

- 結果画面に、チャット設定が有効な場合だけ、承認済み成立ペアごとの「チャットを開く」導線を追加した。クライアントにはopaqueなmatch candidate IDだけを渡し、チャットroom ID、参加者同定、tenant/event境界は引き続きサーバー側で確定する。結果APIも`private, no-store`とした。
- 320px前提の`/liff/chat`を追加し、利用期限表示、規約版確認、双方同意待ちの自動更新、メッセージ一覧・送信、文字数上限、ブロック、通報、結果画面への復帰を実装した。送信は端末側UUIDで冪等化し、サーバー設定の文字数上限をUIにも反映する。
- 本人の同意済み状態はroom setupの安全なbooleanとして返し、再読込み後も二重操作を求めない。相手の同意有無や時刻、participant IDは返さない。ブロック・通報は明示確認後に即時停止し、メッセージを画面から破棄する。
- コンポーネントのAPI直接呼び出しを増やさないよう`useMatchChat`と`useEventResult`へ分離し、結果表示用の機能有効判定もUseCase経由にした。architecture debtはDB直接route `61/62`、client fetch `23/24`でいずれもbaseline以下。
- 検証: lintエラー0（既存warningのみ）、architecture成功、typecheck成功、単体79ファイル400件、結合5ファイル47件、production build成功、依存監査は既知脆弱性0件。新規mobile E2Eで結果→同意→送受信→ブロックと横はみ出しなしを確認した。全E2Eは46件成功・9件skip・既存manual表示1件が並列実行で一時失敗し、該当mobile manual 4件の直列再実行は全件成功した。
- 全体`format:check`はWindows CRLF差による既存473ファイルで失敗。今回変更ファイルの個別Prettierと`git diff --check`は成功した。
- migration 0022/0023適用、staging/productionデプロイ、機能ON、実参加者データ、通知は未実施。次は運営通報対応画面、期限切れ本文の物理削除job、管理画面のチャット設定、正式規約本文と運営フロー確定、合成データstaging UATである。それらが完了するまで機能をONにしない。

### マッチ成立後チャット Phase 4B メッセージ基盤（2026-08-07、実装・検証済み、未公開）

- Phase 4Aのroom・双方同意・72時間・block・report基盤の上に、当事者限定のroom作成、同意、メッセージ一覧・送信、block、report APIを追加した。すべて参加者セッションからtenant/event/participantを確定し、クライアント指定のactor/senderは受け付けない。
- 本文は`SETTINGS_ENCRYPTION_KEY`から用途分離して導出した鍵によるAES-256-GCMで暗号化する。AADへtenant、event、room、sender、client message IDを結び付け、別scopeでの復号を拒否する。API・監査ログ・DBへ平文本文を複製しない。
- migration `0023_lumpy_wallop.sql`で`match_chat_messages`を追加した。roomとsenderをtenant/event複合FKで拘束し、端末側UUIDによる送信冪等性、暗号情報と保存期限のDB CHECK、時系列索引を追加した。
- 送信はroom行をロックし、送信直前にもroom open、当事者、期限を再検証する。1分単位の送信上限判定と保存を同一transaction内で実施するため、並行送信で上限を回避できない。同じclient message IDの再送は本文を二重保存せず、最初のメッセージを返す。
- 一覧・送信のたびに機能ON、成立結果の有効性、双方同意、block、72時間期限を再確認する。レスポンスは送信者を`self | match`だけで表し、相手participant ID、希望順位、非公開メモ等を返さない。期限切れ・論理削除済みの本文は一覧から除外する。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体79ファイル398件、結合5ファイル47件、production build成功。重点17件で暗号化/AAD、冪等性、rate limit、同意、block、結果取消、cross-event FK、API actor注入拒否を確認した。実装中に公開された`js-yaml`の高リスクadvisoryへ対応し、pnpm overrideで4.3.1へ固定後、依存監査は既知脆弱性0件となった。
- 全体`format:check`は既知のWindows改行差を含む既存480ファイルで失敗。変更ファイルは個別Prettier、対象eslint、`git diff --check`で確認する。
- migration 0023適用、staging/productionデプロイ、機能ON、参加者UI、通知、期限切れ行の物理削除job、運営通報対応画面、実データ使用は未実施。次のPhase 4Cは、結果画面からの同意導線とスマートフォン向けチャットUI、通報・block操作、期限表示を独立PRで追加する。規約・保存期間・運営対応手順が確定するまで機能をONにしない。

### マッチ成立後チャット安全基盤 Phase 4A（2026-08-07、実装・検証済み、未公開）

- `packages/match-chat`を新設し、RouteやUIから独立したUseCase/Repository契約を追加した。チャット設定はイベント・tenant・service単位で、初期値は必ずOFFである。
- 有効化には規約版と保存期間が必須。DB CHECKとZodの両方で、規約・保存期間が未設定のままONにできない。既定値は結果公開から72時間、1分10件、本文500文字だが、このPhaseでは送信API・本文保存・参加者UIをまだ公開しない。
- 結果確定が有効かつ承認済みの成立ペアだけroomを作成できる。結果公開日時から正確に72時間を計算し、期限超過、結果確定取消、当事者以外、機能OFFを非公開エラーで拒否する。
- 双方が同じ規約版へ同意するまでroomは開かない。規約版が更新された場合は旧版同意を利用せず再確認を要求する。blockは即時、通報は記録と同時に相手をblockするUseCaseとし、通報詳細を監査ログへ複製しない設計とした。
- migration `0022_low_typhoid_mary.sql`で設定、room、同意、block、通報の各テーブルを追加する。roomは`match_candidates`のtenant/event/candidate/participant A/B複合キーを参照し、成立ペアの差替えやcross-tenant/event roomをDBで拒否する。各同意・block・通報もroomおよびparticipantのtenant/event複合FKでscopeを固定する。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体77ファイル389件、結合5ファイル46件、production build、依存監査（既知脆弱性0件）は成功した。重点の安全テストは単体5件・結合2件すべて成功した。
- 全体`format:check`はWindows改行差を含む既存478ファイルで失敗。変更ファイルは個別Prettier、対象eslint、`git diff --check`で確認する。
- migration 0022適用、staging/productionデプロイ、参加者向けAPI/UI、メッセージ保存・送信、送信rate limit実処理、通知、実データ使用は未実施。Phase 4BはDrizzle Repository、本文暗号化/削除方針、冪等送信、rate limit、当事者限定APIを実装し、Phase 4Cで参加者UIと運営通報画面を追加する。正式なチャット規約・保存期間・通報対応手順が確定するまで公開しない。

### 会話メモ設定・版管理（2026-08-07、実装・独立レビュー・staging migration・配備・合成UAT済み）

- イベント管理画面に「会話メモ設定」を追加した。参加者番号による本人選択、運営作成枠、運営取込枠の登録方式、入力終了日時、公開プロフィールallowlist、最大8件の主タグ選択肢を新しい下書きとして作成できる。
- 公開中の設定を直接編集せず、下書き作成→権限者による公開→停止の専用フローと全版履歴を実装した。新版公開時は同一tenant/event/serviceの旧公開版を自動停止し、過去のoption・参加者メモを削除または上書きしない。
- migration `0021_rapid_falcon.sql`でsnapshotへ`draft | published | stopped`状態と公開・停止日時を追加した。同一tenant/event/serviceで公開中を1件に限定する部分UNIQUE、状態・enabled・日時の整合性CHECK、既存有効版のbackfillを追加した。cross-tenant/eventは従来の複合FKで引き続き拒否する。
- 管理APIはstaff event handler、UseCase、Repository、Drizzle実装の順で分離した。作成・公開・停止は監査ログへ版番号と件数だけを記録し、参加者、相手、感情、本人専用メモを複製しない。作成・閲覧は`event:write`、公開・停止は既存の強い`concierge:publish`権限で保護する。
- 参加者導線は有効な公開snapshotが存在する場合だけ従来どおり表示される。migration適用だけではfeatureはONにならず、管理者が明示的に公開するまで参加者画面は変わらない。
- 独立レビューで管理操作の同時実行を再確認し、イベント行・対象snapshot行のロック、更新結果確認を追加した。下書き版番号の競合、二重公開・二重停止、停止監査ログの重複を防止する。型チェックと関連8テストを再実行して成功した。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体76ファイル382件、結合4ファイル44件、重点8件、production build、依存監査（既知脆弱性0件）、readiness（欠損ファイル0件）は成功した。全E2Eは45件成功・8件skip・既存manual表示1件が一時失敗し、該当mobile manual 4件を直列再実行して全件成功した。既存プロセスが3100番を使用していたため、Playwrightのポートを環境変数で変更可能にして3101番で実行した。
- 全体`format:check`はWindows改行差により既存ファイルを含む472件で失敗したが、変更ファイルは個別Prettierと`git diff --check`で確認する。
- PR #23を`release/2026-08-08-readiness`向けに作成した。初回GitHub Actionsはコード実行前の`Set up job`でGitHub側の`Service Unavailable`により失敗し、公式StatusでもActions Partial Outageを確認した。ローカル検証結果とは分離し、復旧後に同一HEADを再実行する。
- 利用者承認後、stagingが0015までだったため、論理バックアップを取得して未適用migration 0016〜0021を順番に適用した。適用後はmigration 22/22、public table 70、接続先一致、backup readiness issue 0、lifecycle不整合0、複数公開scope 0を確認した。詳細は`MIGRATION_0016_0021_STAGING_RECORD_20260807.md`。
- 同じ承認範囲でPR版をVercel `shime-staging`へ配備した。deployment `dpl_54tq57UaTwpBvapZWmRQMjLK4mYL`はReady、alias health 200、管理ログイン200、staging警告を確認した。`[検証専用] SHIME RH-C`で下書きversion 1作成・公開、version 2作成・公開、旧版自動停止、新版停止を実行し、終了時の公開版0件を確認した。未認証APIは401。詳細は`INTERACTION_MEMO_STAGING_UAT_20260807.md`。
- UAT所見だった存在しないevent IDの空200は、Repositoryの同一tenantイベント存在確認とUseCaseの`EVENT_NOT_FOUND`へ修正した。snapshot検索前に拒否し、cross-tenant eventも同じ非公開エラーとなる。重点5テスト、型、architecture、lint、全テスト、production buildは成功。修正版をstaging deployment `dpl_HBg5HDbK58K5QPMDSq9cXRtE2wWe`へ再配備し、health 200、既知イベント200、未知イベント`404 EVENT_NOT_FOUND`、未認証401、公開中snapshot 0件を確認した。
- 合成スタッフによる権限確認では、対象権限なしの認証済みセッションを`403 FORBIDDEN`で拒否した。390×844pxの認証済みスマートフォン表示では、設定フォーム、版履歴、停止済みversion 1・2、横スクロールなしを確認した。使用した合成スタッフは直後に無効化した。production migration/deploy、release/mainへのマージ、本番イベント設定、本番データ操作、LINE通知は実施していない。次は最新HEADのGitHub Actions確認とreleaseマージ判断である。
- マッチ成立後チャット（双方同意、結果公開済み、72時間、block/report、rate limit、監査、期限後非表示）と、会話メモの匿名集計・運営ダッシュボードは未実装。安全境界が異なるため、それぞれ独立PRとして進める。

### スタッフ個別権限選択（2026-08-06、実装・検証済み、未適用・未デプロイ）

- 管理画面のスタッフ追加・編集で、役割プリセットに加えて19権限をチェックボックスで個別選択できるようにした。プリセット選択時は推奨権限を反映し、その後に必要な権限だけ増減できる。
- `staff_roles.permissions_json`をmigration `0020_smooth_chronomancer.sql`で追加する。`null`の既存行は従来の役割プリセットへフォールバックし、配列が保存されている行はその選択を厳密に使用する。不正値は認証境界でfail closedとなり、DB CHECKでも許可リスト外を拒否する。
- 操作者が自分の保有しない権限を委任する操作、自己の`staff:manage`削除、最後の有効な権限管理者の無効化・権限剥奪、event限定セッションからのtenantスタッフ管理を拒否する。変更時は監査ログを残し、対象スタッフの既存セッションを失効する。
- 全認可箇所を明示権限へ対応し、管理ナビゲーション、イベント設定、受付、席配置、結果確定、通知、バックアップ、Concierge等の表示・API認可を同一の実効権限で判定する。
- 検証: architecture、lint、typecheck、単体75ファイル379件、結合4ファイル43件、production build、依存監査は成功。全E2Eの初回実行は44件成功・8件skip・既存モバイル表示2件が一時失敗したが、該当2ファイルを独立再実行して18件すべて成功した。全体`format:check`は既知のWindows改行差399ファイルで失敗したが、変更の中心11ファイルは個別Prettierと`git diff --check`に成功した。
- `readiness`は欠損ファイル0件。`readiness:strict`は正式イベント情報14項目が未確定のため失敗し、コード不具合とは分離する。
- migration 0020適用、release/mainへのマージ、staging/productionデプロイ、本番データ操作、LINE通知は実施していない。次は独立レビューと合成データでの管理画面UATである。

### 優先プロフィール・非公開メモ PR B（2026-08-06、実装・検証済み、未適用・未デプロイ）

- PR A（PR #19）はGitHubレビュー承認済み・CI成功だが、まだreleaseへマージしていない。PR BはPR AのHEAD `5798dc5`を基点とする積み上げ変更である。
- 会話メモ画面で参加者番号をタップすると、現在の有効snapshotで許可した項目だけを公開プロフィールとして表示する。許可候補はニックネーム、年代、市区町村、職業、趣味、休日の過ごし方、応援してほしいこと、応援できること、公開Dream。初期allowlistは空のため、設定なしでは自動公開しない。
- 公開プロフィールAPIは本人と同一tenant/eventの来場済み会話相手だけを対象とし、現在のslotまたは本人申告slot、参加状態、採番、回避対象を再検証する。`Cache-Control: no-store`。本名、生年月日、電話、メール、LINE ID、詳細住所、管理メモ、申込の非公開回答、希望順位、相手別メモ、被選択数はDTOへ含めない。Dreamは公開設定の値だけを返す。
- 既存の主タグ・お気に入りを維持し、本人専用メモ（最大120文字・3行）と、独立して取消可能な「もう少し話したい」booleanを追加した。後者は相手通知、自動マッチ、スタッフ通常画面表示、AI処理を一切起こさない。既存の主タグ`talk_again`を置換せず、主タグとCTAを独立保存できる設計にした。
- 保存は従来のrevision競合検出・対象別直列化・同値再送の冪等性を維持する。監査ログにはメモ本文やCTA値を記録せず、revisionだけを記録する。
- migration `0019_rich_puff_adder.sql`で`interaction_notes.wants_to_talk_more`と3行以内のDB CHECKを追加し、公開プロフィールallowlistを9項目へ拡張した。0018・0019は全環境未適用。Drizzle schema、migration SQL、metadataは一致し、再生成でschema差分なしを確認した。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体75ファイル373件、結合4ファイル42件、production build成功、全E2E 46件成功・8件skip、依存脆弱性0件。プロフィール・保存・DB制約のfocusedテスト34件と320pxモバイルE2E 3件も成功した。
- 全体`format:check`は既知のWindows改行差436ファイルで失敗。今回変更ファイルは個別Prettierと`git diff --check`で確認する。`readiness`は欠損ファイル0件、`readiness:strict`は正式イベント情報14項目が未確定のため失敗し、コード不具合とは分離する。
- migration適用、release/mainへのマージ、staging/productionデプロイ、feature有効化、本番データ使用、LINE通知は実施していない。次はPR Bの独立レビューであり、PR Aを先にreleaseへマージしてからPR Bを取り込む。
- マッチ後チャットはPR Cとして未実装。当事者限定、結果公開済み、双方同意、72時間、block/report、rate limit、監査、終了後非表示が揃うまで公開しない。

### 優先プロフィール・メモ・マッチ後チャット PR A（2026-08-06、実装済み・未適用・未デプロイ）

- 立食イベント向けに、参加者番号の前方一致検索、番号だけの候補表示、2段階確認、本人申告interaction slot作成、メモ入力前の誤登録取消を追加した。氏名・連絡先・他参加者のメモは返さない。
- actor・target双方の参加確定/来場、同一tenant/event、回避対象、本人選択、対象slot所属をRepositoryとDB制約で検証する。作成・取消は監査ログを残し、同時操作でも新規作成/取消監査が重複しないよう更新結果を確認する。
- migration `0018_graceful_stranger.sql`を追加した。`interaction_notes.private_note_text varchar(120)`と、イベントsnapshotの`public_profile_field_keys_json`を追加する。
- 公開プロフィール項目は`nickname`、`age_or_band`、`residence_municipality`、`occupation`、`hobbies`、`public_dream`だけをZodとDB CHECKの両方で許可する。初期値は空配列であり、自動公開しない。本名・電話・メール・LINE ID・詳細住所・管理メモ・希望順位・相手別メモ・被選択数は許可対象に存在しない。
- migration SQL、Drizzle schema、metadataを再生成照合し、追加差分なしを確認した。0018は全環境未適用。0016/0017は本作業前に利用者からproduction適用結果確認済みと共有されたが、この作業ではDBへ接続して再検証していない。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体74ファイル367件、結合4ファイル42件、production build成功、依存脆弱性0件。今回関連のmobile E2E 3件成功。全E2Eの4並列実行は43件成功・8件skip・3件timeout/表示待ち失敗だったが、失敗3ファイルを直列再実行して10件すべて成功した。
- 全体`format:check`は既知のWindows改行差440ファイルで失敗。今回変更ファイルは個別Prettierと`git diff --check`で確認した。`readiness`は欠損ファイル0件で実行成功、`readiness:strict`は正式イベント情報14項目が未確定のため失敗し、今回のコード不具合とは分離する。
- featureは有効なself-reported snapshotがない限り既定OFF。migration適用、staging/production deploy、イベント設定変更、実データ使用、LINE通知は実施していない。
- 次はPR Aの独立レビュー。承認後のPR Bで番号タップの公開プロフィールDTO、既存ワンタップメモ、120文字本人専用メモ、「もう少し話したい」非公開CTAを実装する。PR Cのチャットは当事者限定・結果公開済み・72時間・同意・block/report・rate limitが揃うまで公開しない。

### LINEリッチメニュー管理画面設定（2026-08-06、productionデプロイ済み・LINE未反映）

- 表示文言と配色を管理画面で設定できる。対象はLINE管理上のメニュー名、メニューバー文言、タップ操作名、画像内3文言、背景・パネル・アクセント・文字の4色。
- タップ先は従来どおり選択イベントのvent付きLIFF URLに限定し、自由URLは許可しない。
- 設定保存とLINEへの反映を分離した。保存ごとに版番号と実行者・時刻・監査ログを記録し、保存だけではLINE公式アカウントを変更しない。未保存変更中は反映できない。
- 反映履歴に設定版と設定スナップショットを保存する。既存履歴は後方互換で読み込む。LINE接続情報の再保存でリッチメニュー履歴を消さないよう既存configを保持する。
- DB migrationは不要。tenant別LINE service config JSONのZod schemaで検証し、tenant境界と管理権限を維持する。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体358件・結合40件成功、production build成功、E2E 45件成功・7件skip、依存脆弱性0件。変更ファイルPrettierと`git diff --check`は成功。全体`format:check`は既知のWindows改行差で失敗。
- `readiness:strict`は正式イベント情報14項目が未確定のため`productionReady: false`。今回のコード不具合とは分離する。
- PR #17をGitHub Actionsの`verify`・`e2e`成功後にreleaseへマージした。merge commitは`b48c2123f860840cb188f270510cbfb39a3f49fb`。
- production deploymentは`dpl_DUFJ3dFSs8VVyLXfsoAt7fs5AyTJ`。`https://app.shimelife.jp`へalias済みで、Vercel Ready、health 200、ログイン画面200、未認証管理画面307を確認した。
- LINE公式アカウントの既定リッチメニュー、本番イベント設定、通知には変更を加えていない。次は管理画面で設定保存を確認し、対象イベントと全利用者への影響を確認してから別操作でLINEへ反映する。

### ワンタップメモ N2参加者UI（2026-08-05、実装済み・未適用・未デプロイ）

- N1の本人専用GET/PUT APIだけを利用する参加者画面`/liff/interactions`を追加した。参加者番号だけをカード表示し、主タグ1つとお気に入りを5〜10秒で選択できる。氏名、連絡先、他参加者のメモ、被選択数は表示・取得しない。
- マージ前レビューで、未採番対象を「番号確認中」として選べる誤記録リスクを検出した。氏名を代替表示せず、参加者番号を安全に識別できない対象はカードから除外するよう修正した。
- N1再レビューで、未採番対象がAPIには残る問題も検出した。RepositoryとUseCaseの双方で未採番対象を返さず、直接PUTも404で拒否するよう修正した。
- SHIME PASSには、有効なイベント別option snapshotがある場合だけ「会話メモを開く」を表示する。feature既定OFF、座席・interaction slot未登録、無効イベントでは既存導線を変えない。
- 320px幅、2列タグ、44px以上の操作領域、選択直後の自動保存、保存中・保存済み・失敗・競合状態を実装した。通信失敗時は選択を保持して再試行でき、対象ごとの保存を直列化して連打・連続変更による二重保存を防ぐ。revision conflict時は自動上書きせず最新内容を再読込する。
- 立食時の相手選択方式（参加者番号前方一致＋本人確認等）は更新版仕様の未決事項`IM-D01`のまま。N2には追加せず、本番featureを有効化しない。管理画面のsnapshot作成・公開も未実装。
- 検証: architecture baseline成功、lintエラー0（既存warningのみ）、typecheck成功、単体355件、結合40件、production build成功。320pxモバイルE2Eは、8人連続入力、選択更新、お気に入り、横スクロールなし、氏名・連絡先・未採番対象の非表示、初回通信失敗後の選択保持と再試行の2件が成功した。PR #15のGitHub Actions verify・E2Eも成功した。
- 全体`format:check`はWindows改行由来の既存446ファイルで失敗したため、今回変更ファイルのPrettierと`git diff --check`を個別確認した。
- N2固有のDB・migration・API契約変更はない。PR #13/N0、PR #14/N1、PR #15/N2は依存順に`release/2026-08-08-readiness`へマージ済み。統合後release HEAD `c7d9b5c`のGitHub Actions verify・E2Eは成功した。
- migration 0017は全環境未適用。mainへのマージ、staging/production deployment、本番設定、実データ使用、LINE通知は実施していない。次はバックアップ、0017適用判断、合成データでの実機UATを別承認で行う。立食の対象者選択方式をクライアントが確定し、実機UATを完了するまではfeatureをOFFに保つ。N3集計・運営ログ、N4ラスト3分は別フェーズとする。

### ワンタップメモ N1基盤（2026-08-05、実装済み・未適用・未デプロイ）

- N0設計から独立した`@shime/interactions`モジュールを追加し、Repository、UseCase、Drizzle実装、参加者GET/PUT APIを実装した。画面、管理設定、立食時の相手選択、通知、集計、AIは追加していない。
- migration `0017_previous_squadron_sinister.sql`で、イベント別option snapshot、interaction slot、slot participant、本人専用noteを追加した。tenant、event、service、participant、slot、optionの整合性は複合外部キーで保証し、actor自身、slot外、cross-tenant/event/service、snapshot外optionをDBでも拒否する。
- featureは有効snapshotが存在しない限り既定OFF。参加確定・来場済みの本人だけが、自分と同じ実会話slotの対象一覧と自分のメモを取得・更新できる。相手のメモ、被選択数、氏名、LINE情報は返さない。
- 保存は主タグ1つ＋favorite、PUT、expected revisionで競合を検出する。同値再送は現在値を返し、unique制約で二重行を防止する。監査ログにはnote内容を残さずrevisionだけを記録する。
- 再レビューでnoteの一意制約と既存行検索へ`snapshot_id`を追加した。新snapshotを有効化しても旧版メモを変更せず、新版入力を別行として保存できる。migration SQL、Drizzle schema、metadataは一致し、schema driftがないことを確認した。
- APIは`Cache-Control: no-store`、成功`{ data }`、失敗`{ code, message, request_id }`。取消・欠席、回避対象、slot外を非公開エラーで拒否する。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体352件、結合40件、production build成功。interaction memoのfocused単体・契約・DB結合テストは14件成功し、旧・新snapshotの同一slot/targetメモ共存も確認した。PR #14のGitHub Actions verify・E2Eも成功した。
- 全体`format:check`はWindows改行由来の既存432ファイルで失敗。今回変更ファイルは個別Prettierと`git diff --check`で確認する。
- migration 0017は全環境未適用。PR #13〜#15はreleaseへマージ済みだが、mainへのマージ、staging/production deployment、本番設定、実データ使用、LINE通知は実施していない。
- 次はN2参加者画面の合成データ実機UAT。立食用の参加者番号前方一致＋確認、slot作成、管理画面の版付き設定は`IM-D01`未決のためN2へ含めない。本番日が近いため、0017適用とfeature有効化は別のGo判断とバックアップ承認を必須とする。

### ワンタップメモ N0調査（2026-08-05、設計完了・未実装）

- 更新版仕様が指定するN0を実施し、現行participants、席配置、conversation pairs、preferences、matching、participant認証、Concierge、notification、audit、permissionを調査した。
- 現行`conversation_pairs`は着席配置公開時だけ生成され、`round_no=1`固定である。立食イベントでは会話相手を自動生成できないため、既存テーブルの意味を変えず、汎用`interaction_slots`とslot participantsを新設する方針とした。
- メモは希望入力へ保存せず、本人だけが取得・更新できる独立interaction moduleとする。通常スタッフの生メモ閲覧、相手通知、人気集計、AI、ラスト3分、チャットはN1対象外。
- event別の不変option snapshot、主タグ1つ＋favorite、PUT＋revision、DB複合scope制約、320px片手操作のAPI・画面案をN0成果物5件へ記録した。
- N1前の主要未決は、立食時の会話相手登録方式。推奨は参加者番号前方一致＋確認によるself-reportだが、承認・実機UATまではfeatureを既定OFFとする。
- DB、migration、API、UI、production、staging、通知には変更を加えていない。

### PR #10マージ後レビュー・migration 0016検証（2026-08-04、追補修正済み・未デプロイ）

- PR #10（`codex/marriage-v2-m2-pre-event` → `release/2026-08-08-readiness`）のrelease差分61ファイルを独立確認した。PR #10は2026-08-03に`e621ae3`でマージ済み。以下のレビュー修正はそのmerge commitに含まれず、追補PRが必要。
- migration `0016_previous_serpent_society.sql`とDrizzle schemaは、`applications.additional_answers jsonb not null default '{}'`で一致する。PGlite空DBへ0000〜0016を順番適用し、列のdefaultと合成プロフィール回答の保存を確認した。production・stagingに0016は未適用。
- レビューで、画面の必須・選択肢制約が公開申込APIで再検証されていない入力整合性問題を1件検出した。同一tenant/eventの`event_form_fields`と参加区分をAPI境界で照合し、未設定キー、必須漏れ、選択肢外、未設定参加区分を保存前に拒否するよう修正した。
- 依存監査で新しい勧告を検出し、`brace-expansion 5.0.9`と`postcss 8.5.23`へ固定版・overrideを同期した。再監査は既知脆弱性0件。
- 検証: architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体340件、結合38件、production build成功、E2E 43件成功・5件skip、dependency audit脆弱性0件。
- `format:check`は既知48ファイルのWindows改行差で失敗。`readiness`は欠損ファイル0件だが正式入力14項目が未確定、`readiness:strict`も同理由で失敗。コード不具合とは分離する。
- レビュー修正は`e299369`として作業ブランチへcommit/push済み。追補PR #11を作成し、初回GitHub Actionsのverify・E2Eはいずれも成功した。release/mainへの直接push、DB migration適用、deployment、本番データ使用、LINE通知は実施していない。次はPR #11の独立再レビューとマージ判断。

### marriage_v2 3問診断（2026-08-03、実装済み・未デプロイ）

- 現行の4分析軸診断を`schemaVersion: 1`として維持し、新しい婚活版を`schemaVersion: 2`として追加した。既存の公開版・イベントスナップショット・API導線は変更しない。
- marriage_v2の質問コードと表示文を「今日の気持ち」「今日大切にしたいこと」「今日期待していること」の3問として管理画面のプリセットへ追加した。
- クライアント未確定の選択肢は推測せず空欄にする。3問すべてに有効な選択肢が設定されるまで公開検証は通らない。
- 参加者画面、途中保存、revision conflict、二重提出防止、カード画像認可、回答非公開の既存基盤を再利用し、3問完了時だけ提出可能にした。V1は従来どおり4問完了が必要。
- V2結果は決定論的な`concierge-rule-v2`で、基本感情、今日のテーマ、行動準備度、選択カード、固定支援文を返す。外部AIは使用しない。
- DB変更とmigrationはない。productionイベントへの適用、デプロイ、通知、リッチメニュー切替は実施していない。
- 検証: 変更ファイルPrettier成功、architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体339件・結合38件、production build、E2E 43件成功・5件skip、依存監査脆弱性0件。
- 全体`format:check`は今回変更していない既存48ファイルのWindows改行差で失敗したが、今回の変更ファイルはすべて成功。`readiness`は欠損ファイル0件で成功し、`readiness:strict`は正式イベント情報14項目が未確定のため想定どおり失敗した。いずれも今回のV2コード不具合とは分離する。
- 残るP0は、クライアントが3問の正式選択肢・必須性・8枚のカード文言/画像を確定し、管理画面でV2テンプレートを新規作成・公開して本番イベントへ版付きスナップショットとして適用すること。

### PDFプロフィール・応援フォーム保存基盤（2026-08-03、実装済み・未デプロイ）

- クライアント支給PDFに合わせ、職業、趣味、休日の過ごし方、応援してほしいこと、応援できることの標準5項目を追加した。
- 新規イベントの申込フォームには標準5項目を任意項目として初期設定する。既存イベントは管理画面の「プロフィール・応援5項目を追加」で重複なく追加できる。
- 公開申込フォームは、従来の固定項目だけでなく、管理画面で公開したイベント固有の追加項目を表示・送信できる。
- 追加回答は`applications.additional_answers`へイベントの申込情報として保存する。キー形式、回答長、最大項目数をZodで制限し、CSV再取込では上書きしない。
- migration `0016_previous_serpent_society.sql`を生成した。どの環境にも未適用であり、production適用には別途バックアップ確認と明示承認が必要。
- 検証: 変更ファイルPrettier成功、architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体332件・結合38件、production build、E2E 42件成功・4件skip。
- 全体`format:check`は今回変更していない既存59ファイルのWindows改行差で失敗したが、今回の変更ファイルはすべて成功。
- `readiness`は欠損ファイル0件で実行成功。`readiness:strict`は正式イベント情報14項目が未確定のため想定どおり失敗し、今回のコード不具合とは分離して扱う。
- productionイベント設定、DB migration、デプロイ、リッチメニュー切替、通知送信は実施していない。
- 次のP0実装候補は、PDFの3問診断フローと現行Conciergeの4分析軸公開条件を両立させる版付きテンプレート仕様の確定・実装。その後、8枚のカード文言・画像を本番イベント用スナップショットとして設定する。

### PDF当日導線・立食＋診断設定（2026-08-03、実装済み・未デプロイ）

- クライアント支給PDFの8月8日導線を新しい基準とし、最初の実装単位としてイベント別導線ON/OFFを拡張した。
- 管理画面でDream、席案内5問、SHIME診断を個別に導線へ追加・除外できる。SHIME PASSは必須のままで無効化できない。
- 立食イベントには`Dream → SHIME診断 → PASS`を一括設定し、席案内5問を無効にするプリセットを追加した。既存の着席イベントの既定導線と公開済み版は変更しない。
- SHIME診断をONにした導線の公開時は、従来どおり同一tenant/eventの有効な診断スナップショットが必要。
- 検証: 変更ファイルPrettier成功、architecture成功、lintエラー0（既存warningのみ）、typecheck成功、単体331件・結合37件成功、production build成功。全体`format:check`は既存60ファイルのWindows改行差で失敗したが、今回の変更ファイルは成功。
- DB migration、productionイベント設定、デプロイ、リッチメニュー切替、通知送信は実施していない。
- 次のP0実装は、PDFのプロフィール（職業・趣味・休日の過ごし方）とサポートプロフィール（応援してほしいこと・応援できること）の版付きフォーム保存基盤。

### イベント単位の立食モード（2026-08-03、実装済み・未デプロイ）

- イベント設定に`seatingMode: assigned | standing`を追加した。既存イベントと値のないイベントは互換性維持のため`assigned`として扱う。
- 管理画面で「着席（席指定・席案内を使う）」と「立食（席指定・席案内を使わない）」を選択できる。立食時はテーブル・席マスター、席案内5問、席配置をイベントナビゲーション、設定チェック、クイック操作から除外する。
- 立食時は参加者導線から席案内5問を除外し、Dream完了後にSHIME PASSを発行できる。PASSには席案内を表示せず、参加者席APIも既存の過去データを返さない。
- 着席・立食の切替で既存のテーブル、席、5問、配置履歴は削除しない。着席へ戻した場合の再利用と過去イベントの再現性を保持する。
- `EVENT_CONFIG_20260808.yaml`は今回の本番イベントを`standing`、席配置無効、席替え回数なしとして更新した。厳格readinessの未確定入力は15件から14件へ減少した。
- 検証: architecture、lint（エラー0）、typecheck、単体328件、結合37件、production build成功。全E2Eは着席fixtureへ`assigned`を明示後、42件成功・4件対象外skip。立食PASSで席案内を表示しないE2Eも含む。
- 全体`format:check`は既存64ファイルのWindows改行差で失敗。今回の変更ファイルは個別Prettierと`git diff --check`で確認する。
- productionイベント設定変更、DB migration、deploy、通知送信は実施していない。次はPRレビュー、releaseへのマージ承認、production deploy後に本番イベントで「立食」を保存し、設定チェックと実機導線を再確認する。

### 実運用リハーサルへ切替（2026-08-03）

- 8月8日の本番を優先し、新機能追加を停止して、全規模、複数端末、障害、代替運用、復旧を含む実運用テストへ切り替えた。
- `pnpm readiness`相当を再実行し、欠損ファイル0件、`REQUIRED_INPUT`15件、`productionReady: false`を確認した。strict失敗はコード不具合ではなく正式イベント情報未確定による。
- 少人数の正常系はproduction隔離UATで申込、LINE連携、Dream、5問、PASS、受付、席公開・PASS席表示まで確認済み。
- 現在のP0は、正式情報15項目、50名・受付5端末相当、紙運用、別環境復旧、希望・結果・通知、定期ジョブ・監視の実地確認。
- 実施順、中止条件、8月7日Go判定、8月8日開始前ゲートを`PRODUCTION_OPERATIONAL_REHEARSAL_PLAN_20260803.md`へ記録した。
- productionイベント変更、通知送信、deploy、migrationは実施していない。
- production隔離UATの合成参加者で本人連携リンクを再発行し、誤った補助本人確認と、同一eventですでに別参加者へ連携済みのLINEアカウントによる二重連携が拒否されることを実機確認した。拒否後も対象参加者は未採番・未連携、リンクは有効のまま維持された。使用済み・期限切れ・2端末同時確定は引き続き未確認。
- production隔離UATのA01を再検索した際、受付済み参加者には受付確定操作が表示されず二重受付を防止した。理由「受付操作の訂正」とリハーサル補足付きで受付を取消し、参加者番号・受付番号を維持したまま再受付して受付済みへ復帰した。QRカメラと2端末同時受付は未確認。
- A01の参加者側PASS同期確認時、公式LINEにリッチメニューまたは参加画面への常設導線がなく、参加者が再入場方法を判断できないことを実機運用課題として検出した。管理画面が生成するevent付きLIFF再開URLを一時代替とし、8月4日までにリッチメニューまたは公式メッセージの常設導線を確定する。代替導線未確定のままならP0へ昇格する。

### 管理画面LINEリッチメニュー生成（2026-08-03、production・隔離UAT実機確認済み）

- システム管理者専用の`外部接続・運用設定`へ、イベントを選択してSHIME標準リッチメニューを生成し、LINE公式アカウントの既定メニューへ反映する機能を追加した。
- 生成画像はLINE仕様に合わせたPNG（2500x843、1MB以下）。タップ領域は選択イベントのevent付きLIFF再開URLを開く。
- LINE公式APIの検証、メニュー作成、画像登録、既定反映の順に実行し、生成版・対象イベント・実行者・日時を設定履歴と監査ログへ保存する。過去メニューは削除せず履歴を保持する。
- LINE反映前の失敗では既存の既定メニューを変更しない。LINE反映後にDB記録が失敗した場合は以前の既定メニューを復元し、新規作成メニューを削除する。
- 同一tenantのイベントだけを選択可能とし、LINE接続・LIFF ID・Channel Access Tokenが未設定の場合は実行不可。全友だちへ影響するためチェック確認と最終確認ダイアログを必須にした。
- 検証: 専用単体7件成功、全単体・全結合テスト、architecture、lint（エラー0）、typecheck、production build成功。最終件数は完了報告を参照。
- 全体`format:check`は既存47ファイル（主にCRLF）の未整形で失敗。今回の変更ファイルはPrettier成功、`git diff --check`成功。
- commit `8aa1c7b`を含むPR #6をreleaseへマージした。merge commitは`7f5440979efe4e23077fd9c7dbe10d3349db0172`。
- 初回production deployment `dpl_451o1nD5KpddNHQhR4LFU9xj7sWM`では、Vercel Linux環境で`sharp`の`libvips`ネイティブライブラリをロードできず、リッチメニューAPIが認証前に500となる不具合を検出した。LINE API呼出し前の失敗であり、LINE公式アカウント側の変更は発生していない。
- ネイティブ依存を使わない決定論的PNG生成へ置換し、単体7件、format、architecture、lint、typecheck、全test、build、E2E、dependency audit、readinessをGitHub Actionsで確認した。修正PR #7をreleaseへマージし、merge commitは`7a616a9`。
- 最終production deploymentは`dpl_6Ln3XKd2HHKP5wjH4Cg5A192PmJ3`。`https://app.shimelife.jp`へalias済みで、health 200、未認証管理画面307、未認証リッチメニューAPI 401を確認した。
- 2026-08-03 18:50（JST）、システム管理者が`[UAT専用] SHIME Client UAT`を選択し、LINE公式アカウントの既定リッチメニューへ1回だけ反映した。管理画面の成功表示と対象イベント・反映日時の履歴を確認した。
- 同じLINE公式アカウントのスマートフォン実機でリッチメニューからLIFFを開き、`app.shimelife.jp`の連携済み参加者画面へ復帰し、`本人連携が完了しました`とUATイベント名が表示されることを確認した。実イベントへの切替は行っていない。
- 常設導線P1は隔離UATで解消。8月8日の本番前に、正式イベント設定完了後、manager承認のもと対象を本番イベントへ切り替え、別スタッフ端末でも1回確認する。

### LIFF 2.29.2更新・LINE認証回帰・IAP監査（2026-08-01）

- `@line/liff`はnpm packageをClient Componentから直接importする方式で、CDNは使用していない。
- npm registryの現在版`2.29.2`へ更新し、lockfileの全LIFFモジュールも`2.29.2`に更新した。
- LINE IDトークンをLINE検証APIへ`client_id`付きで送るテスト、期限切れ拒否テストを追加した。
- LIFF戻りの直接query、`liff.state`、tokenなし再入場、直接値とstateの優先順を自動テストした。
- LINE IAPは未実装。SDKの依存に`@liff/iap`が含まれることと、SHIMEで課金機能が実装済みであることを混同しない。
- Messaging API Webhookは署名検証とtenant+webhook event IDの重複排除を実装済み。IAP Webhookの署名・`orderId`冪等性・付与処理は未実装で、IAP有効化前P0とした。
- IAP手数料率と規約同意日は対象channelの申請画面の実表示/操作記録がないため未確認。推測値は記録しない。
- 検証: 変更ファイルformat成功、architecture成功、lintエラー0、typecheck成功、単体316件、結合37件、build成功、E2E 40件成功・4件skip、dependency auditは脆弱性0件。
- 全体`format:check`はWindows working treeの既存47ファイルのCRLF差で失敗したが、今回の変更ファイルは全て成功。
- 詳細: `docs/shime/LINE_LIFF_IAP_AUDIT_20260801.md`
- commit `0e1c4f9`をpushし、`release/2026-08-08-readiness`向けdraft PR #6を作成した。
- 次の操作: PR #6のCI確認後、隔離UATでLINEログイン→本人連携→Dream画面復帰を1回確認する。マージ・deployは別承認まで行わない。

### 初心者向けクライアントUAT手順公開（2026-07-31）

- クライアントUATガイドへ「はじめての方へ」と12段階の操作手順を追加した。
- 申込、管理検索、LINEリンク発行、本人連携、Dream、5問、PASS、QR、受付、
  席配置・公開、PASS席確認、希望・結果、報告まで、押す場所・期待表示・確認項目・
  操作を止める条件を初心者向けに記載した。
- PCとスマートフォンの2台構成、1台だけの場合、異なる参加区分2名が必要な席確認、
  `CATEGORY_PAIR_CONFLICT`時の対応、実通知禁止、合成データ限定を明記した。
- UAT専用の管理ログイン、ガイド、申込フォームURLを記載した。パスワードは記載していない。
- manual unit 5件、manual E2E 7件成功・1件skip、production buildに成功した。
- commit `6c2906b9ecc2f2af3d11665dbca1fd3871b06acb`をreleaseへpushし、production deployment
  `dpl_5eACuBevQ68Vp75sc2WDu7ZCJRrb`へ反映した。
- 公開後、download 200、初心者手順とステップ12の反映、health 200、
  未認証Web版のlogin redirect 307を確認した。
- 次はクライアントがステップ0から順に操作し、最初に迷った箇所または要修正を報告する。
- **本番Go判定ではない。**

### UAT管理者パスワード復旧（2026-07-31）

- 利用者の明示承認に基づき、production隔離tenant `shime-uat`の既存管理者
  `uat-admin`だけを対象にパスワードをローテーションした。
- bootstrap結果は`created: false`、`passwordChanged: true`、`roleCreated: false`であり、
  tenant、イベント、参加者、既存ロールの新規作成・変更はない。
- ローテーション後、`https://app.shimelife.jp/api/admin/session`へ同じ認証情報で
  HTTP 200となり、session cookieが発行されることを確認した。
- パスワード、pepper、DB URLその他の秘密値はログ、文書、Gitへ記録していない。
- クライアントへ`uat-admin`を共有せず、必要時は権限を限定した専用アカウントを作成する。

### クライアントUATガイド公開（2026-07-31）

- `docs/shime/CLIENT_UAT_GUIDE_20260731.md`へ、参加者・スタッフ双方の画面確認、
  現在の基準フロー、フロー確定回答、正式イベント情報15項目、問題報告様式、
  P0/P1/P2判定、8月7日までの確認日程、承認記録を整理した。
- 実データを使わずUAT専用イベントと合成参加者だけを使用する安全条件を明記した。
- 管理者認証必須のWeb版`/admin/manual/uat`と、スマートフォン保存用Markdownを追加した。
- 公開マニュアル一覧`/manual`と管理者用ナビゲーションからアクセスできる。
- architecture、lint、typecheck、単体312件、結合37件、production buildに成功した。
  マニュアルE2Eは7件成功・デスクトップ対象外1件skip。
- commit `cb53da7fd4a1f43930b69fe892de1c95d3c05739`をreleaseへpushし、
  production deployment `dpl_8z5wUqKYGsQMmpRuHt2qSWMT8ysr`へ反映した。
- 公開後、`/manual` 200、UATガイド表示、Markdown download 200、
  未認証`/admin/manual/uat`のlogin redirect 307、health 200を確認した。
- 次はクライアントがUATガイドに沿って初回確認を行い、導線と15項目を回答する。
- **本番Go判定ではない。**

### production隔離UAT・参加者PASS席表示（2026-07-31）

- 独自ドメイン`https://app.shimelife.jp`で、UAT専用tenant・イベント・合成参加者だけを使用した。
- LINE/LIFF、本人連携、Dream、席案内5問、PASS、QR、手動受付、席配置・公開までを実機確認した。
- カテゴリが片側1名だけのときは`CATEGORY_PAIR_CONFLICT`で不正な席保存を防止し、
  異なるカテゴリ2名では配置・ロック・保存・公開まで完了した。
- UAT中、公開済み席がSHIME PASSへ表示されない不足を発見した。
- 参加者本人の公開済み席だけを返すRepository / UseCaseへAPIを分離し、PASSに
  テーブル・席番号、準備中表示、更新操作を追加した。
- 単体312件・結合37件、architecture、lint、typecheck、buildに成功した。
  新規E2Eはモバイル・デスクトップ4件成功。全E2Eは37件成功・4件skipで、
  既存マニュアル1件が並列実行時だけ失敗したが単独再実行3件は成功した。
- commit `67fc36e8383ad449c116dfcd32ae336d9d39399a`をreleaseへpushし、
  production deployment `dpl_3oxmU4iWmJ4VpsBjdDDwRYYip2s9`へ反映した。
- deployment `READY`、独自ドメインalias、health 200、未認証席API 401を確認した。
- 修正後のスマートフォンでA01に`T01 / T01-1`が表示される最終確認が次の操作。
- 詳細: `docs/shime/PRODUCTION_UAT_EXECUTION_20260731.md`
- **本番Go判定ではない。**

### 管理者・参加者マニュアル整備（2026-07-31）

- `docs/shime/ADMINISTRATOR_MANUAL.md`へ、権限、初期設定、申込・CSV、LINE連携、
  当日受付、席配置、希望・結果、通知、CSV、障害対応、本番前チェックを統合した。
- `docs/shime/PARTICIPANT_MANUAL.md`へ、申込、LINE本人連携、Dream、席案内5問、
  SHIME診断、PASS・受付QR、席、希望、結果、トラブル対応、プライバシーを統合した。
- `docs/shime/MANUAL_INDEX.md`に対象範囲と配布時の注意を記録した。
- 管理トップの「運用資料をダウンロード」へ管理者用・参加者用の2冊を追加し、
  `pnpm docs:sync`でスマートフォンから取得できる公開ファイルを生成する設定とした。
- Web版として、公開一覧`/manual`、参加者用`/manual/participant`、認証必須の
  管理者用`/admin/manual`を追加した。Markdown正本から静的・安全なReact要素へ変換し、
  目次、章内リンク、表、チェックリスト、Markdown保存、印刷、モバイル表示に対応した。
- 管理画面の全スタッフ共通メニューへ「操作マニュアル」を追加した。
- Love Passport公開プロフィールは未実装のため操作対象に含めず、決済は2026-08-08の
  必須導線に含めないことを明記した。
- 検証: 変更ファイルPrettier、architecture、lint、typecheck、単体307件、
  結合37件、production buildに成功した。WebマニュアルE2Eはモバイル・デスクトップで
  5件成功、デスクトップ対象外1件skip。管理者用の未認証アクセスがloginへ戻ること、
  参加者用に横スクロールがないことを確認した。
- commit `c991fbf170da4a636bb617a50805e8c62ecff9ea`を
  `release/2026-08-08-readiness`へpushし、productionへデプロイした。
- productionの`APP_URL`を`https://app.shimelife.jp`へ更新し、Vercelの独自ドメイン、
  SSL、`/api/health` 200を確認した。
- 公開後確認: `/manual` 200、`/manual/participant` 200、未認証の`/admin/manual`は
  `/admin/login`へ307、管理者用・参加者用Markdownダウンロードはいずれも200。
- 本番Go判定と既存P0の状態は変更しない。

### production基盤 初期反映（2026-07-30 17:50）

- 利用者の明示承認に基づき、新規production Supabase
  `dipcpqmbmumazyuorslv`のDashboard physical backupを確認した。
- 本番DBは新規空DBだったため、migration 0000〜0015の全16件を初期適用した。
- postflightはmigration head 0015、scope不整合11件すべて0、欠落制約・テーブル0、
  `safe: true`。runtime/migration接続が同一DBであることも確認した。
- private Storage bucket `shime-private-imports`と`shime-private-concierge`を作成した。
- 独立Vercel project `shime-production`を作成し、release HEAD
  `859da688`を`https://shime-production.vercel.app`へproduction deployした。
- Vercel runtimeのdirect DB hostnameによる`ENOTFOUND`を検出し、検証済み東京Transaction
  Pooler 6543へ変更した。current deployment IDは`dpl_GgVDH4MntkqCuRjcFjDZDHWL2na7`、stateはREADY。
- health 200、未認証管理画面のlogin redirect、production画面にstaging警告がないことを確認した。
- 単体304件、結合37件、E2E 29件（3件skip）、architecture、lint、typecheck、
  build、dependency auditに成功した。
- 隔離tenant `shime-uat`、管理者`uat-admin`、UAT event `uat-client-20260730`を作成した。
  eventは設定完全、status `accepting`、20席、Dream 8カード（AI無効）、5問、
  UAT専用仮規約2件、合成申込・参加者各1件。他tenant eventは0件。
- 管理者パスワード、pepper、本人連携tokenはログ・文書・Gitへ記録していない。
- LINE/LIFF、OpenAIは本番未設定。本番LINE導線の端末UATは未実施。
- REQUIRED_INPUT 15件、復旧リハーサル、全導線UAT、監視・定期ジョブ確認が残るため、
  **本番Go判定ではない**。
- 詳細: `docs/shime/PRODUCTION_FOUNDATION_ROLLOUT_20260730.md`

### Concierge Phase 1B staging実機確認準備（2026-07-28 19:30）

- staging DBの読み取り専用確認で、Concierge card、template、event snapshot、sessionがすべて0件であることを確認した。
- `scripts/setup-concierge-rehearsal.ts`を追加した。`APP_ENV=staging`、RH形式イベント、
  draft/accepting、診断OFF、private Storageを強制し、既定は読み取り専用dry-run。
- RH-Aへ合成カード8枚、公開済み検証テンプレートv1、イベント専用スナップショットを適用した。
- 適用後に4問・8感情・8カードのsnapshotが有効な構造であること、公開カード8件、
  participant diagnosis session 0件、private bucketを確認した。
- 診断は`enabled=false`のまま。LINE通知、外部AI、実参加者データは使用していない。
- 単体304件・結合37件、E2E 29件（3件は意図的skip）、architecture、lint、typecheck、
  build、dependency auditに成功した。
- 詳細: `docs/shime/CONCIERGE_REHEARSAL_SETUP_20260728.md`
- 次は管理者が短い利用期間を設定して診断を一時的にONにし、本人連携済みRH-A合成参加者で
  スマートフォン実機確認を行う。終了後はOFFへ戻す。

### PR #3 release反映・migration 0015 staging適用（2026-07-28 19:05）

- PR #3を`release/2026-08-08-readiness`へmergeした。merge commitは`cef5ace36768b2af82e4dc47cdf91d250d9fbdc5`。
- secretを出力しない接続確認で対象をstagingと識別し、runtime/migrationが同一DBを参照することを確認した。
- リポジトリ外へロジカルバックアップ`staging-pre-0015-20260728-185625`を作成し、
  3ファイルのsizeとSHA-256を記録した。復旧手順も適用前に確認した。
- 読み取り専用preflightはmigration head 0014、11件のscope不整合すべて0、`safe: true`。
- migration 0015をstagingへ適用し、読み取り専用postflightでmigration head 0015、
  11件のscope不整合すべて0、欠落制約・テーブル・検査なし、`safe: true`を確認した。
- 適用後はpublic tables 65、applied migrations 16、Storage private、backup readiness true。
- 単体301件・結合37件とproduction buildに成功した。
- Vercel stagingへdeployment `dpl_FgcLfXXWA5wDmzXzDhcseyCDnqLJ`を反映した。
  `https://shime-staging.vercel.app`でhealth 200、staging警告、robots拒否、
  未認証管理画面307、未認証診断API 401を確認した。
- 詳細証跡: `docs/shime/MIGRATION_0015_STAGING_RECORD_20260728.md`
- **production migration、production deploy、診断有効化、実データ利用、通知送信は未実施。**
- この完了はstaging技術反映の記録であり、本番Go判定ではない。

### CodexによるPR #3最終再レビュー（2026-07-28 18:55）

PR #3のDB scope、migration、参加者API、スタッフAPI、カード画像認可、revision conflict、
二重提出防止、診断回答非公開、モバイルE2E、既存機能への影響を再確認した。

- migration pre/postflightの初版には、全11件のscope checkが欠けても`Array.every()`が真となる場合と、
  同名制約がpublic schema内の別テーブルに存在しても合格し得る誤判定余地があった。
- `safe`判定に、DBセッションが実際にread-onlyであること、11件すべての存在、重複なしを追加した。
- postflightの制約確認を、制約名だけでなく所有テーブルと種別（UNIQUE / FOREIGN KEY）の組み合わせへ強化した。
- 実migrationをPGliteへ全適用し、期待する29制約が正しい所有テーブル・種別で存在する結合テストを追加した。
- 未選択カードの表面情報、他参加者の選択カード・回答・結果は公開されず、
  画像取得は診断有効・期間・tenant/event/participant session・現在選択カードを検証することを再確認した。
- revision conflict、提出済みsessionの再提出拒否、同一revision結果のDB重複拒否を再確認した。
- **コード上の未解決P0/P1はなし。PR #3はreleaseブランチへマージ可能と判定する。**
- ただし、この判定は本番可能判定ではない。migration適用、staging deploy、実機リハーサル、
  REQUIRED_INPUT 15件、本番Go/No-Goは未完了のまま。
- 本セッションではPR merge、DB接続、migration適用、deploy、実データ利用、通知送信を行っていない。

### Codexによるmigration 0015 staging適用前準備（2026-07-28 18:35）

staging・productionへ接続せず、migration 0015を安全に適用するための検査と手順を追加した。

- `pnpm db:preflight:0015`: migration headが0014であることと、0015が追加する複合外部キーに抵触する
  既存tenant/event不整合11種類が0件であることを読み取り専用接続で確認する。
- `pnpm db:verify:0015`: migration headが0015であること、対象テーブル5件・制約29件の存在、
  scope不整合が0件であることを読み取り専用で確認する。
- 両コマンドは`DATABASE_MIGRATION_URL`のみを使用し、セッションを
  `default_transaction_read_only=on`に設定する。出力はmigration timestamp、制約名・テーブル名、
  集計件数のみで、URL・password・PII・実データ行は出力しない。
- 正常scopeと全11種の不整合検出をPGlite合成DBで検証し、migration SQLとの検査契約同期テストを追加した。
- `docs/shime/MIGRATION_0015_STAGING_RUNBOOK.md`に、事前停止条件、backup、preflight、適用、
  postflight、失敗時の停止・復旧・証跡様式を記録した。
- **未実施**: DB接続、backup作成、migration適用、staging deploy、production操作、PR merge。
- PR #3は本追加差分の再レビューが必要なため、引き続きマージ保留。

### CodexによるConcierge template/snapshot scope修正（2026-07-28 17:50）

再レビューで、イベントsnapshotの`template_version_id`と`applied_by`が単一ID参照であり、
別tenantのテンプレート版・適用者をDBが拒否できないことを確認し、親テンプレートまで含めて修正した。

- `concierge_templates(tenant_id, id)`へ実体のあるUNIQUE制約を追加。
- `concierge_templates(tenant_id, created_by)`から`users(tenant_id, id)`への複合外部キーを追加。
- `concierge_template_versions(tenant_id, id, version)`へ実体のあるUNIQUE制約を追加。
- template versionからtemplateと作成者へのtenant複合外部キーを追加。
- event snapshotからtemplate version（version番号を含む）と適用者へのtenant複合外部キーを追加。
- 同一scopeの既存正常系を維持し、cross-tenant template、template creator、template version creator、
  snapshot template version、snapshot applierの不整合を拒否する結合テスト5件を追加。
- 0015 SQL・Drizzle schema・`0015_snapshot.json`を同期し、
  `pnpm db:generate`が`No schema changes, nothing to migrate`となることを確認。0016は残していない。
- 実装コミット: `ef23fb7`。
- migration未適用、staging未デプロイ、PR未マージ。次の作業は追加scope修正の独立再レビュー。

### CodexによるPR #3再レビュー追加指摘修正（2026-07-28 16:25）

独立再レビューで、0015のSQL・Drizzle schemaに追加済みのscope制約が
`packages/db/migrations/meta/0015_snapshot.json`へ反映されていないことと、参加者を起点とする
application/user scopeがDBで完全には固定されていないことを確認し、追加修正した。

- **migration metadata同期**: 0015 snapshotを現在のschemaから再生成し、`events_tenant_id_uidx`、
  `participants_event_scope_fk`、`event_concierge_snapshots_event_scope_fk`を含む全scope制約を同期した。
- **次migration差分確認**: 同期後に`pnpm db:generate`を再実行し、
  `No schema changes, nothing to migrate`となることを確認した。新しい0016は残していない。
- **application scope**: `applications(tenant_id, event_id, id)`へ実体のあるUNIQUE制約を追加し、
  `applications(tenant_id, event_id)`から`events(tenant_id, id)`への複合外部キーを追加した。
- **participant scope**: `participants(tenant_id, event_id, application_id)`からapplicationsへの複合外部キーと、
  `participants(tenant_id, user_id)`からusersへの複合外部キーを追加した。
- **participant session scope**: `participant_sessions(tenant_id, user_id)`から
  `users(tenant_id, id)`への複合外部キーを追加した。
- **DBテスト**: 同一scopeのapplication・participant・participant session成功に加え、cross-tenant eventのapplication、
  cross-tenant applicationのparticipant、cross-tenant userのparticipant、cross-tenant userのparticipant sessionを
  DBが拒否するテストを追加した。
- **実装コミット**: `c1627b7`。
- **安全状態**: migration未適用、staging未デプロイ、PR未マージ。次の作業は今回の追加修正の独立再レビュー。

### CodexによるPR #3レビュー指摘修正（2026-07-27 23:15）

PR #3のレビューで判明したP0/P1を修正した。**修正コードとテストは成功しているが、独立した再レビューが完了するまでマージ保留を維持する。**

- **P0修正**: `events(tenant_id, id)`へ実体のあるUNIQUE制約を追加し、`event_concierge_snapshots(tenant_id, event_id)`および`participants(tenant_id, event_id)`からイベントscopeへの複合外部キーを追加。sessionは既存のparticipant/snapshot複合FKを介して同じtenant/eventへ固定される。Drizzle schemaと未適用migration 0015を同時更新した。
- **P0テスト**: 同一tenant/eventのsnapshot INSERT成功、cross-tenant snapshot INSERT拒否、cross-tenant participant INSERT拒否を追加。既存のsession/answer/revision/result/access-log不整合拒否も再確認した。
- **P1修正**: 選択前APIはopaqueなカードIDと表示順だけを返し、タイトル・メッセージ・感情コード・画像URL等を返さない。カード選択時に空回答を許可する既存`saveDraft`へrevision付きで即時保存し、現在選択済み1枚だけ表面情報を返す。
- **P1画像認可**: 画像取得UseCaseは、診断有効・利用期間内・同一tenant/event/participant session・現在選択済みカードをすべて確認する。未選択カード、他参加者のカード、無効または期間外の診断はobject keyを返さず404となる。
- **レビュー判定**: P0/P1のコード修正は完了。PR #3は再レビューが完了するまで**マージ保留**。
- **実装コミットSHA**: `f04d045fcae7bd59a2365f7404d5b1068ffd1a23`。
- **実行済みテスト**: 単体293件・結合25件・E2E29件（すべて成功、E2E 3件は意図的skip）。architecture、lint、typecheck、build、dependency auditも成功。
- **format:check**: Windows作業ツリーのCRLFにより、今回変更していない27ファイルだけをPrettierが検出して失敗。今回変更した実装・テストは個別Prettier適用済みで、Git indexはLF。コードフォーマット不良とは区別する。
- **DB migrationは未適用**: `packages/db/migrations/0015_strange_mandroid.sql`はこのブランチにローカルで存在するのみで、staging・productionを含むどの環境にも適用していない。
- **staging環境への変更は未実施**: migration適用・デプロイ・端末確認のいずれも行っていない。
- **PR状態**: PR #3は未マージ。`release/2026-08-08-readiness`、`main`への直接pushは行っていない。
- **次のアクション**: PR #3のP0/P1修正を再レビューし、DB scope、選択前レスポンス、画像認可、revision conflict、既存機能への影響を再確認する。再レビューで問題がなければ初めてreleaseブランチへのマージ可否を判定する。

Concierge Phase 1B（SHIME診断機能）は、レビュー指摘の修正、最終再レビュー、
releaseへのPR #3 merge、staging migration、staging deploy、公開スモークまで完了した。
**migration 0015とreleaseアプリは2026-07-30にproductionへ反映済み。**
実参加者データ利用、診断有効化、通知送信は行っていない。

テスト件数（最新）:

- 単体テスト: 304件成功
- 結合テスト: 37件成功
- E2E: 29件成功・3件は意図的スキップ（モバイル専用テストのデスクトップ project skip）

検証コマンドの結果は本ファイルの「直近の検証結果」を参照。

## 現在の未完了項目

1. **クライアント初回UAT** — Web版ガイドに沿って参加者・スタッフ導線、画面文言、
   SHIME診断の使用・配置を確認し、P0/P1/P2で回答する。
2. **正式イベント情報** — `EVENT_CONFIG_20260808.yaml`の15項目をクライアントが確定する。
3. **修正後PASS席表示の実機確認** — A01本人のPASSで公開済み`T01 / T01-1`を確認する。
4. **認証済みConcierge実機確認** — production UATでは診断導線をまだ実施していない。
5. **残る導線・全規模リハーサル・復旧訓練** — 希望・結果・通知、匿名化50名、
   受付端末5台、通信障害、紙運用、バックアップ復旧の実施記録が必要。
6. **定期ジョブ・監視** — 高頻度ジョブ、障害検知、運営への通知経路を確認する。
7. **本番Go／No-Go** — 上記P0が1件でも残る間は本番可能と判定しない。

## 直近の検証結果（2026-07-28、Codex）

```text
pnpm format:check        → Windows CRLF環境差により失敗（今回未変更の45ファイル。Git indexはLF）
pnpm architecture:check  → 成功
pnpm lint                → 成功（0 errors / 68+9 warnings）
pnpm typecheck           → 成功
pnpm test                → 成功（単体304件・結合37件）
pnpm build               → 成功
pnpm test:e2e             → 成功（29件・3件は意図的スキップ）
pnpm audit:dependencies   → 成功（既知の脆弱性なし）
pnpm readiness            → 完走（productionReady: false、REQUIRED_INPUT 15件）
pnpm readiness:strict     → 失敗（exit code 1）。コード不具合ではない。
```

`pnpm format:check`で検出された45ファイルは今回の変更対象外であり、`git ls-files --eol`ではindexがLF、Windows作業ツリーがCRLFだった。今回変更した実装・テストは個別にPrettierを適用し、個別チェックと`git diff --check`に成功している。無関係ファイルの一括整形は差分拡大を避けるため実施していない。

`pnpm readiness:strict`の失敗理由: `docs/shime/EVENT_CONFIG_20260808.yaml`の`REQUIRED_INPUT`未確定項目が15件残っているため。対象キー:

```text
event.name
event.ends_at
event.venue_name
event.venue_address
application.opens_at
application.closes_at
preference.opens_at
preference.closes_at
participants.categories[0].label
participants.categories[1].label
seating.conversation_rounds
emotion_cards.card_set_code
privacy.retention_days
privacy.event_terms_version
privacy.privacy_version
```

これは運営側が確定すべき事務的な値であり、Concierge Phase 1Bの実装状態とは無関係。

`pnpm test:e2e`はこのセッションのサンドボックス環境ではPlaywright同梱ブラウザとの版数不一致（`chrome-headless-shell`欠如）のため、`playwright.config.ts`へ一時的に`launchOptions.executablePath: "/opt/pw-browsers/chromium"`を追加して実行・検証し、**検証後にコミットせず元へ戻した**。他環境で実行ファイルが見つからない場合は`pnpm exec playwright install`、またはその環境固有の`executablePath`を指定すること。

## 今回のDB scope整合性修正（2026-07-25、Claude Code）

migration 0015で追加したConciergeテーブルは、単一カラムの外部キー（`participant_id`が`participants.id`に存在する、等）はあったが、**参照先が同じtenant・eventに属することはDBレベルで強制していなかった。** アプリケーション層のRepositoryクエリは正しくtenant/event/participantで絞り込んでいたが、DB制約としては、存在すれば良いだけの緩い保証だった。

### 追加した複合UNIQUE制約（親テーブル側、複合外部キーの参照先として必要）

- `participants`: `(tenant_id, event_id, id)` — `participants_tenant_event_id_uidx`
- `event_concierge_snapshots`: `(tenant_id, event_id, id)` — `event_concierge_snapshots_tenant_event_id_uidx`
- `concierge_sessions`: `(tenant_id, event_id, id)` — `concierge_sessions_tenant_event_id_uidx`
- `users`: `(tenant_id, id)` — `users_tenant_scope_uidx`
- `concierge_card_asset_versions`: `(tenant_id, id)` — `concierge_card_asset_versions_tenant_id_uidx`

Drizzleの`uniqueIndex()`は`CREATE UNIQUE INDEX`を生成するだけで、PostgreSQLの複合外部キーの参照先として使えない（`unique or primary key constraint`が必要、単なる一意インデックスでは`there is no unique constraint matching given keys`エラーになる）。そのため`unique()`（`ADD CONSTRAINT ... UNIQUE`）を使用した。

### 追加した複合外部キー（9件）

- `concierge_sessions` → `participants`: `(tenant_id, event_id, participant_id)` → `(tenant_id, event_id, id)`
- `concierge_sessions` → `event_concierge_snapshots`: `(tenant_id, event_id, snapshot_id)` → `(tenant_id, event_id, id)`
- `concierge_sessions` → `concierge_card_asset_versions`: `(tenant_id, selected_card_asset_version_id)` → `(tenant_id, id)`（`selected_card_asset_version_id`はnullable。PostgreSQLのデフォルトMATCH SIMPLEにより、未選択時はNULLとして制約をスキップする）
- `concierge_answers` → `concierge_sessions`: `(tenant_id, event_id, session_id)` → `(tenant_id, event_id, id)`
- `concierge_answer_revisions` → `concierge_sessions`: 同上
- `concierge_rule_results` → `concierge_sessions`: 同上
- `concierge_access_logs` → `participants`: `(tenant_id, event_id, participant_id)` → `(tenant_id, event_id, id)`
- `concierge_access_logs` → `concierge_sessions`: `(tenant_id, event_id, session_id)` → `(tenant_id, event_id, id)`（`session_id`はnullable。同様にMATCH SIMPLEでスキップ）
- `concierge_access_logs` → `users`: `(tenant_id, viewer_user_id)` → `(tenant_id, id)`

既存の単一カラム外部キーはそのまま残している（複合外部キーが包含する形になるが、削除は本修正の範囲外かつリスクがあるため触れていない）。

### migrationファイルの扱い

0015はまだどの環境にも適用されていないため、`0015_giant_rick_jones.sql`は削除し、`0015_strange_mandroid.sql`として再生成した（内容はConcierge Phase 1B分＋今回の複合制約分を統合した単一migration）。Drizzle schemaとmigration SQLの内容は一致している（`pnpm db:generate`で再生成し、実PostgreSQL互換DB（PGlite）に適用して検証済み）。

**注意**: `drizzle-kit generate`が生成する文の並び順は、既存テーブルへの複合UNIQUE制約追加（`ALTER TABLE ... ADD CONSTRAINT ... UNIQUE`）を、それに依存する複合外部キー（`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`）より後ろに置いてしまうため、生成直後はPostgreSQLが`there is no unique constraint matching given keys`で拒否した。migrationファイル内でUNIQUE制約の4文を外部キー追加ブロックの直前へ手動で移動し、解決した（新規テーブル`concierge_sessions`自身のUNIQUE制約は`CREATE TABLE`に内包されるため対象外）。今後この種の複合外部キーを追加する場合、`pnpm db:generate`後に生成SQLの文の順序を必ず確認すること。

### 追加した不整合データ拒否テスト（結合テスト、10件）

`tests/integration/concierge-diagnosis.test.ts`に`describe("concierge diagnosis cross-tenant / cross-event scope integrity")`として追加。SELECTでの分離確認ではなく、**INSERT自体がDB制約により失敗すること**を検証する。

- session→participant: 別tenantのparticipant指定で拒否
- session→participant: 同一tenant内の別eventのparticipant指定で拒否
- session→snapshot: 別tenantのsnapshot指定で拒否
- session→selected_card_asset_version_id: 別tenantのカードバージョン指定で拒否
- answer→session: 別tenantのsession指定で拒否
- answer revision→session: 別tenantのsession指定で拒否
- rule result→session: 別tenantのsession指定で拒否
- access log→participant: 別tenantのparticipant指定で拒否
- access log→session: 別tenantのsession指定で拒否
- access log→viewer_user_id: 別tenantのuser指定で拒否

### Repositoryの再確認

`packages/concierge/src/drizzle-repository.ts`の全メソッドを確認した。読み取り・更新・挿入のすべてのクエリで`tenant_id`・`event_id`（該当する場合は`participant_id`/`session_id`）がWHERE句に含まれており、tenant/event/participant条件が欠けている箇所はなかった。今回のDB制約強化はアプリケーション層の不備を修正したものではなく、アプリケーション層が正しく行っている絞り込みを、DB層でも二重に保証する防御的多層化である。

## staging migration適用の手順（次に行うこと）

1. staging Supabaseの`DATABASE_MIGRATION_URL`（direct connectionまたはsession pooler、5432番ポート）を用意できる環境で本ブランチを取得する。
2. `pnpm install`。
3. `DATABASE_MIGRATION_URL`を環境変数に設定し、`pnpm db:migrate`を実行する。
4. 適用後、`concierge_sessions`等の新規テーブルと、今回追加した複合UNIQUE制約・複合外部キーがstaging上に存在することを確認する（`\d concierge_sessions`等で外部キー一覧を確認）。
5. 診断設定はOFFのまま、Phase 1Aで保存済みの有効なスナップショットを使って端末確認を行う（staging端末確認）。
6. 端末確認後、Phase 1B完成コミットを作成し、AI_HANDOFF.mdへ適用結果を記録する。
7. 本番反映は別途レビューと明示承認を受けて行う。

## 中断時の安全状態

- `main` へのマージは行っていない。
- `release/2026-08-08-readiness` への直接pushは行っていない（PR経由）。
- Supabaseへのマイグレーション適用は行っていない（staging・production とも）。
- Vercelへのデプロイは行っていない。
- SHIME診断を既存イベントでONにする操作は行っていない。
- 外部AI接続、AI生成、AIジョブ、再試行、フォールバック処理は実装していない。
- `.env`、APIキー、LINEトークン、個人情報は変更・コミットしていない。
- 本番参加者への通知送信は行っていない。

## 既存の本番準備ベースライン（Concierge以外を含む全体像）

このブランチに先行して記録されていた本番準備情報。現時点の判定は **Go / No-Go未判定**。

確認済みの主な内容:

- staging、Supabase migration、private Storage、バックアップ基盤
- 管理者認証、権限、イベント境界、未認証API拒否
- CSV取込後の参加者生成と、イベント単位の決定論的な参加者番号採番
- 合成参加者によるLINE本人連携、Dream、5問、PASS、QR再発行、手動受付、取消、再受付
- 手動受付、本人連携一覧、管理ナビゲーション、席調整画面のスマートフォン改善
- 会場テンプレートの版管理、イベント適用、スナップショット、アーカイブ保持

本番準備として未完了・未判定の主な内容:

- `EVENT_CONFIG_20260808.yaml` の `REQUIRED_INPUT` 解消
- 正式イベント値、正式規約、保存期間の確定
- LINE期限切れ・再利用拒否、QRカメラ受付、Dream非公開・任意スキップ、5問途中保存・辞退の全確認
- 欠席後の席再計算、manager公開、公開前非表示の通し確認
- 希望入力3方式、一方希望非公開、複数成立競合、manager確定
- 結果通知のプレビュー、送信、失敗、再送、二重送信防止
- 通常CSV、責任者限定CSV、紙の受付表・席表による代替運用
- 高頻度ジョブ、監視・通知、production昇格、独自ドメイン
- 匿名化50名・受付端末5台の本番相当リハーサル

既存の本番準備P0順序:

1. 現在状態と本番準備資料の再同期
2. 合成イベントによる非ブロック導線リハーサル
3. ジョブ・監視・復旧確認
4. 正式イベント設定
5. production昇格と最終Go判定

## Concierge Phase 1Bの実装内容（参考）

### ドメイン基盤

- `packages/concierge` を新設。
- Phase 1Aで保存したイベント専用スナップショットをZodで検証。公開可能条件として4分析軸・8感情・8枚の重複しないカード対応を検証。
- 診断の開始、途中保存、提出、再回答、結果閲覧、管理設定更新、進捗集計のUseCaseを実装。
- 判定は `concierge-rule-v1` の決定論的ルールベースで、生成AIを使用しない。
- 結果は選択カード、固定感情コード、4問の選択内容から構成し、性格・相性・医学的状態を断定しない。
- DBアクセスをRepository実装に限定し、UseCaseからDrizzleを直接参照しない構造。
- 保存済み結果の読み出し境界にZodスキーマを追加。

### DBスキーマ

`packages/db/src/schema.ts` に追加:

- イベント診断設定（利用開始・終了日時、再回答許可）
- `concierge_sessions` / `concierge_answers` / `concierge_answer_revisions` / `concierge_rule_results` / `concierge_access_logs`
- `concierge_session_status` enum
- tenant/event/participant scopeを強制する複合UNIQUE制約・複合外部キー（本セッションで追加、詳細は上記）

### 参加者向け画面・API

- `/liff/diagnosis` の参加者画面。8枚を参加者セッション単位で決定論的にシャッフルし、裏面から1枚を選ぶ操作。
- 4問回答、途中保存、確認、提出、固定ルール結果表示、許可時の回答見直し。
- スマートフォン向け2列カード表示と大きい操作領域のCSS。
- 参加者API: 診断状態取得・開始・途中保存・提出・認証済みカード画像取得。
- カード画像のStorage object keyをブラウザへ返さず、認証後の署名URLリダイレクトで配信。

### 管理画面・参加者導線

- イベント別診断管理画面（SHIME診断ON/OFF、利用開始・終了日時、回答見直し許可、対象者数・進捗）。
- 管理APIに診断設定GET/PATCHを追加（GETは`concierge:manage`、PATCHは`concierge:publish`を要求）。
- 参加者導線設定でSHIME診断をON/OFFできるようにした。診断設定が有効でないイベントでは、SHIME診断を含む導線を公開できないガードを追加。
- PASS必須、Dream・席案内5問をPASSより前に置く既存制約は維持。

### 主な変更ファイル

- `packages/concierge/**`
- `packages/db/src/schema.ts`、`packages/db/migrations/0015_strange_mandroid.sql`
- `packages/event-core/src/participant-journey-types.ts` / `participant-journey-repository.ts` / `manage-participant-journey.ts` / `drizzle-participant-journey-repository.ts`
- `apps/web/src/server/concierge-diagnosis-use-cases.ts`
- `apps/web/src/hooks/use-diagnosis.ts` / `use-concierge-event-settings.ts`
- `apps/web/src/app/liff/diagnosis/page.tsx`
- `apps/web/src/app/api/liff/events/[eventId]/diagnosis/**`
- `apps/web/src/app/api/admin/events/[eventId]/concierge-status/route.ts`
- `apps/web/src/app/admin/events/[eventId]/concierge/**` / `journey/**`
- `tests/unit/concierge-diagnosis-use-cases.test.ts` / `concierge-diagnosis-routes.test.ts`
- `tests/integration/concierge-diagnosis.test.ts`
- `tests/e2e/concierge-diagnosis.spec.ts`

## E2Eで発見・修正した画面状態同期バグ（過去の記録として保持）

E2E追加中、「4問回答して確認画面へ進む」操作で回答内容が消えてカード選択画面に戻る不具合を発見した。単体・結合・契約テストでは検出できなかった、複数画面をまたぐ状態遷移特有のバグだった。

原因: `apps/web/src/app/liff/diagnosis/page.tsx`のローカル状態同期ロジックが、セッションの`id`と`revision`をキーに「セッションが変わったらサーバー状態から再同期する」処理を行っていたが、`revision`は途中保存・確認のたびに通常のフローとして毎回インクリメントされる値であり、そのたびに再同期が発火して入力中の内容を上書きしていた。さらに`apps/web/src/hooks/use-diagnosis.ts`の`save()`が`selectedCardAssetVersionId`をローカルの`session`に反映し忘れていたため、再同期時に常にカード未選択状態へ戻っていた。

修正: `save()`で`selectedCardAssetVersionId`も正しく反映し、再同期キーを`` `${session.id}:${session.revision}` ``から`` `${session.id}:${session.submittedAt ?? "null"}` ``へ変更（新規開始・再回答オープン時のみ発火し、通常の途中保存では発火しない）。

---

## 過去の状態（記録・時系列。現在の状態は本ファイル冒頭を参照）

以下はCodexからの引継ぎ時点および各セッションの作業ログであり、現在はすべて解消済みか、上記の現在の状態セクションに統合されている。個々の項目を現在の状態として参照しないこと。

### Codex引継ぎ時点（2026-07-25 13:xx、解消済み）

引継ぎ時点では次の状態だった（すべて本セッションまでに解消）:

- 追加コードは未フォーマット・未型検証だった → フォーマット・型チェックとも完了済み。
- migrationファイルが存在せず、デプロイするとDB列・テーブル不足で失敗する状態だった → migration 0015として生成・レビュー済み（未適用）。
- 単体・結合・契約・E2Eテストとも未実施だった → すべて追加・成功済み。
- `pnpm install --lockfile-only`、`pnpm db:generate`、`pnpm typecheck`の実行結果が未確認だった → いずれも完了・成功。

### 作業ログ（時系列）

**1. 型チェック・lint・migration生成（Claude Code）**

`@shime/concierge`のtsconfig/vitestパスエイリアス欠落、`use-cases.ts`の判別共用体の絞り込み不具合、`import type`と値importの混在、`exactOptionalPropertyTypes`不整合を修正し`pnpm typecheck`を通した。`react-hooks/set-state-in-effect`（React 19新ルール）によるlint error 2件をReact公式パターンに沿って解消。`scripts/check-architecture-baseline.ts`のヒューリスティックを補正（module hookからのfetchをclient component debtとして誤カウントしないよう修正、baseline値は引き下げのみ）。誤った層（同期スキーマ）を検証していたテストを、実際のUseCase層を検証する内容に修正。`pnpm db:generate`でmigration 0015を生成・レビュー。

**2. 単体テスト追加（41件、Claude Code）**

`tests/unit/concierge-diagnosis-use-cases.test.ts`。無効/期間外/不正スナップショット、4分析軸・8感情・8カード公開条件、不正回答・重複回答、途中保存・revision conflict、4問未完了時の提出拒否、決定論的な結果、再回答許可/拒否、保存済み結果のZod境界検証をカバー。

**3. 結合テスト追加（当時9件、Claude Code）**

`tests/integration/concierge-diagnosis.test.ts`。PGlite + `drizzle-orm/pglite/migrator`でmigration 0015を実DB相当環境に適用し、テーブル作成、各種unique制約、参加者間・テナント間のデータ分離、アクセスログ履歴を検証。

**4. APIルート契約テスト追加（17件、Claude Code）**

`tests/unit/concierge-diagnosis-routes.test.ts`。実際のroute.ts（`GET`/`PUT`/`POST`/`PATCH`）を`vi.mock`でDB/Storage境界のみ差し替えて検証。participant API、カード画像認可（生のストレージキーが露出しないこと）、staff APIの権限非対称性（GETは`concierge:manage`、PATCHは`concierge:publish`）をカバー。

**5. E2E追加と状態同期バグの発見・修正（Claude Code）**

`tests/e2e/concierge-diagnosis.spec.ts`。モバイル幅でのカード選択→4問回答→確認→提出→結果表示を検証。この過程で画面状態同期バグを発見・修正（詳細は上記「E2Eで発見・修正した画面状態同期バグ」参照）。

**6. DB scope整合性修正、負の結合テスト追加、文書整理（本セッション、Claude Code）**

上記「今回のDB scope整合性修正」を参照。migrationを0015のまま再生成し、複合UNIQUE制約・複合外部キーを追加。不整合データ拒否の結合テスト10件を追加（結合テスト計22件）。本ファイルを現在の状態が1箇所に集約される構成へ再編。
