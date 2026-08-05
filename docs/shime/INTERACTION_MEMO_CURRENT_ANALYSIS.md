# ワンタップメモ 現行実装調査

更新日: 2026-08-05  
対象基準: `release/2026-08-08-readiness` (`fd62ec9`)  
対象Phase: Marriage v2 M2.5 / N0

## 結論

現行の `conversation_pairs` はワンタップメモの候補抽出元として一部再利用できるが、単独では要件を満たさない。着席配置の公開時にだけ生成され、立食イベントでは生成されないためである。また、現在の生成処理は `round_no = 1` 固定で、複数の会話回を区別できない。

既存の希望入力 `preferences` へメモを保存してはならない。希望はイベント終盤の提出データであり、会話中の本人用感情ログとは保存時期、公開範囲、編集期限、集計目的が異なる。

N1では、既存機能を変更せず、独立したinteraction moduleを追加する必要がある。

## 既存データから自動生成できる対象

### 着席イベント

- 席配置公開時、同じテーブルの参加者同士が `conversation_pairs` に登録される。
- `tenant_id`、`event_id`、参加者2名、`round_no`を持つ。
- 希望候補APIは、この会話ペアを基準に本人の相手候補を抽出している。
- 接触回避、参加状態、チェックイン状態の除外処理は希望候補APIに存在し、interaction moduleへ移植できる。

制限:

- `round_no`は現在1固定。
- seating runとの参照が保存されない。
- テーブル全員の組合せを会話済みとみなすため、実際に一対一で話した保証はない。
- 過去の公開runをsupersedeしても、作成済みペアの由来を判別できない。

### 立食イベント

- `conversation_pairs`を生成する処理がない。
- 席、テーブル、席案内5問は無効化される。
- したがって、現行データだけでは「実際に会話した相手」を自動生成できない。

## interaction slot新設の要否

新設が必要である。

理由:

1. 同じ相手と複数回会話した場合を区別する必要がある。
2. 着席、立食、将来のビジネス交流会を同じ境界で扱う必要がある。
3. どの仕組みが会話対象を作成したかを追跡する必要がある。
4. メモの一意条件に `interaction_slot_id` が明記されている。
5. 既存 `conversation_pairs` を変更すると希望入力と過去イベントへ影響する。

## preferences・matchingとの重複

| 領域 | 目的 | 保存時期 | 公開範囲 | interaction noteとの関係 |
|---|---|---|---|---|
| `preferences` | 成立希望の正式提出 | 希望入力期間 | 本人と限定管理者 | メモから自動選択しない。本人画面で参照する場合も別API |
| `match_candidates` | 双方希望の運営確認 | 希望提出後 | manager以上 | 生メモを入力に使わない |
| `matching_results` | 確定結果 | manager確定後 | 成立者へ限定公開 | 成立数だけ本人集計へ利用可能 |
| interaction note | 会話時の本人感情ログ | 会話中 | 本人のみ | 希望・結果から独立 |

## 認証・権限

- 参加者APIは既存 `participantHandler` を利用できる。
- `requireParticipantForEvent` はtenant、event、user、participantを同時に拘束する。
- 生メモにはスタッフ用読取permissionを追加しない。
- reception、operator、managerは生メモを取得できない。
- 将来break-glass閲覧が必要になった場合は、法務決定、専用permission、理由必須、監査を別Phaseで追加する。

## 監査

- 既存 `audit_logs` は利用できる。
- 生のfeeling code、相手番号、自由文を監査ログへ複製しない。
- 記録するのはaction、note ID、revision、event ID、actor user ID、request ID等の最小メタデータとする。
- 自動保存の各タップをすべて監査するとログが過大になるため、N1では作成と最終状態変更の最小記録を採用する。

## 通知

- `notifications`とLINE送信基盤は存在するが、N1〜N3では利用しない。
- メモ作成、変更、お気に入り設定を相手へ通知してはならない。

## Conciergeとの関係

- Concierge session、回答、結果はtenant/event/participantで分離されている。
- 診断回答とinteraction noteを同じテーブルやAPIに保存しない。
- N3の本人向け集計は件数だけをルールベースで扱い、相手別メモをAIへ渡さない。

## 既存機能への影響

- v1/v2のPASS、受付、席配置、希望、結果は変更不要。
- N1は既定OFFのイベント機能として追加する。
- 既存 `conversation_pairs` は読み取り元としてのみ利用し、schemaや意味を変更しない。
- 2026-08-08へ入れる場合も、立食時の会話対象登録方式が確定し実機UATに合格するまで有効化しない。

