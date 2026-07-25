# SHIME Codex／Claude Code 引き継ぎ運用手順

- 対象: `team478a/shime`
- 本番目標: 2026-08-08
- 基本ブランチ: `release/2026-08-08-readiness`
- 運用方式: 同時作業ではなく交代制

## 1. 基本原則

CodexとClaude Codeの会話履歴は自動共有されない。
次の4点だけを共通の事実として扱う。

1. GitHub上の最新コード
2. ブランチとコミット履歴
3. `docs/shime/AI_HANDOFF.md`
4. 本番準備・リハーサル記録

AIの口頭報告だけを引き継ぎ根拠にしない。

## 2. 作業担当の考え方

### Codex

- 通常の主担当
- リポジトリ全体の調査
- 実装、テスト、差分レビュー
- Claude Codeが作成した変更の再確認

### Claude Code

- Codexの利用制限時の継続担当
- `CLAUDE.md`、`AGENTS.md`、Git履歴から状態を復元
- 1つのP0作業を完了してGitHubへ返す

担当AIによって品質基準や仕様を変えない。

## 3. 作業開始時の共通手順

```bash
git fetch origin
git checkout release/2026-08-08-readiness
git pull --ff-only origin release/2026-08-08-readiness
git status --short --branch
git log --oneline -10
```

次に以下を読む。

```text
AGENTS.md
CLAUDE.md
docs/shime/AI_HANDOFF.md
docs/shime/PHASE8_READINESS_REPORT.md
docs/shime/REHEARSAL_EXECUTION_RECORD_20260715.md
docs/shime/PHASE8_REHEARSAL_CHECKLIST.md
```

未コミット変更がある場合:

- 誰が作成した変更か確認する。
- 内容を消さない。
- 不明な変更を勝手に混ぜてコミットしない。
- 必要なら作業を止め、引き継ぎ文書へ状態を記録する。

## 4. CodexからClaude Codeへ交代する手順

### 4.1 Codex側

作業を止める前に次を行う。

```bash
pnpm format:check
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

変更に応じて次も実行する。

```bash
pnpm readiness:strict
pnpm test:e2e
```

その後:

1. `docs/shime/AI_HANDOFF.md`を更新する。
2. 完了・未完了・失敗テストを明記する。
3. 次に行う作業を1件だけ指定する。
4. 変更をコミットする。
5. ブランチへpushする。

推奨コミット例:

```bash
git add <対象ファイル>
git commit -m "chore: hand off P0 readiness work"
git push origin release/2026-08-08-readiness
```

### 4.2 Claude Codeへの開始指示

```text
CodexからSHIME本番準備を引き継いでください。

release/2026-08-08-readinessブランチを最新化し、
AGENTS.md、CLAUDE.md、docs/shime/AI_HANDOFF.mdを最初に読んでください。

git statusと直近10コミットを確認し、
AI_HANDOFF.mdに指定された次のP0を1件だけ進めてください。

過去の会話履歴は前提にせず、GitHub上のコードと文書を正としてください。
作業終了時は検証を実行し、AI_HANDOFF.mdを更新してコミット・pushしてください。
mainには直接pushしないでください。
```

## 5. Claude CodeからCodexへ戻す手順

### 5.1 Claude Code側

Claude CodeもCodexと同じ終了手順を行う。

- 関連検証を実行
- `AI_HANDOFF.md`更新
- リハーサル実施時は証跡文書更新
- focused commit
- branch push

変更途中のまま交代する場合は、コード内に曖昧なTODOを残すだけでなく、次を文書へ記録する。

- 何が動くか
- 何が動かないか
- 変更途中のファイル
- 失敗しているテスト
- DB migrationの適用有無
- ロールバック方法

### 5.2 Codexへの再開始指示

```text
Claude CodeからSHIME本番準備を引き継いでください。

release/2026-08-08-readinessブランチを最新化し、
AGENTS.md、CLAUDE.md、docs/shime/AI_HANDOFF.mdを確認してください。

Claude Codeの最終コミットと、その直前コミットとの差分をレビューしてください。
特に以下を確認してください。

- tenant_id / event_id境界
- 権限と監査ログ
- 個人情報と秘密情報の漏えい
- 一方希望・順位・非公開Dreamの非公開性
- 席・結果のmanager確定前公開
- 冪等性、重複通知、再試行
- migrationと既存データ保全
- スマートフォン運用
- テスト不足

問題があれば先に修正し、その後AI_HANDOFF.mdの次のP0を1件だけ進めてください。
```

## 6. 同時作業を禁止する範囲

次のファイル・機能は同時に2つのAIが変更しない。

- DB schema・migration
- 認証、LINE、LIFF、セッション
- 参加者番号、受付、Passport
- 席計算、希望判定、結果確定
- 通知キュー、再送、Cron
- `AI_HANDOFF.md`
- 本番準備・リハーサル記録

並行作業が必要な場合は、別ブランチと別worktreeに分離し、統合担当を1人に固定する。
ただし2026-08-08本番までは、原則として交代制を優先する。

## 7. コミットの分け方

1コミットには、原則として次のいずれか1つだけを含める。

- 1つの不具合修正
- 1つのP0検証追加
- 1つの運用文書更新
- 1つのmigrationと対応コード

避ける例:

- 大規模リファクタリングと本番不具合修正を同時に行う
- UI変更、DB変更、通知変更を理由なく1コミットにまとめる
- 自動生成ファイル以外を一括整形して差分を膨らませる

## 8. 検証レベル

### 文書のみ

```bash
pnpm format:check
```

### UI・API・ドメインロジック

```bash
pnpm format:check
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### DB・外部接続・本番準備

上記に加えて:

```bash
pnpm readiness:strict
pnpm test:e2e
pnpm supabase:verify
pnpm supabase:verify-storage
pnpm supabase:backup-readiness
```

外部環境が必要なコマンドは、対象環境と実行日時を記録する。

## 9. 本番前の禁止事項

- 未承認でproductionへデプロイしない。
- 本番参加者データを検証環境へコピーしない。
- 本番LINEへ合成参加者通知を送らない。
- `.env`や秘密値をコミットしない。
- migrationを適用した事実を記録せずに交代しない。
- P0未解消の状態で本番可能と記載しない。
- テスト未実行を「問題なし」と報告しない。

## 10. 緊急時の最小引き継ぎ

制限到達などで通常手順を完了できない場合でも、最低限以下をGitHubへ残す。

```markdown
## 緊急引き継ぎ

- 現在ブランチ:
- 最終コミット:
- 未コミット変更:
- 作業中のP0:
- 完了部分:
- 未完了部分:
- 失敗中のテスト:
- migration適用状況:
- 次に開くファイル:
- 次に実行するコマンド:
```

未コミット変更を別環境へ渡す必要がある場合は、可能な限りWIPコミットを作成してpushする。
秘密値や本番個人情報を含む場合はコミットせず、変更箇所だけを記録して安全に停止する。
