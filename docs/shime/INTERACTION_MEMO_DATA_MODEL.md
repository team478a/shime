# ワンタップメモ データモデル案

更新日: 2026-08-05  
状態: N0設計。migration未作成

## 設計原則

- tenant、event、service、participantの整合性をDB複合外部キーでも保証する。
- 選択肢はイベントへ適用した時点の版を固定し、後から文言を変更しても過去イベントを再現できるようにする。
- 生メモは本人専用とし、希望、結果、通知、AIデータへ直接結合しない。
- 着席と立食を同じinteraction slotで表現する。
- 既存テーブルを破壊的に変更しない。

## 推奨テーブル

### `event_interaction_note_snapshots`

イベントに適用された不変の設定版。

- `id`
- `tenant_id`
- `service_type`
- `event_id`
- `version`
- `enabled`
- `target_source`: N1は`interaction_slot`。将来の`self_reported | operator_import`は方式確定後に追加する
- `editable_until`
- `created_by`
- `created_at`
- `updated_at`

制約:

- UNIQUE `(tenant_id, event_id, service_type, version)`
- UNIQUE `(tenant_id, event_id, service_type, id)` を複合FK参照先として作成
- FK `(tenant_id, event_id)` → `events(tenant_id, id)`
- 公開後のsnapshotは更新しない。変更時は新versionを作成する。

### `interaction_note_options`

イベントsnapshot内の表示選択肢。

- `id`
- `tenant_id`
- `event_id`
- `snapshot_id`
- `code`
- `label`
- `display_order`
- `enabled`
- `is_negative`
- timestamps

初期婚活テンプレート候補:

- `reassured`: 安心した
- `enjoyed`: 楽しかった
- `empathized`: 共感した
- `talk_again`: もう一度話したい
- `support`: 応援したい
- `no_connection`: ご縁なし

制約:

- UNIQUE `(tenant_id, event_id, service_type, snapshot_id, code)`
- FK `(tenant_id, event_id, service_type, snapshot_id)` → event snapshot
- 公開後の行は更新・削除せず、新snapshotへコピーする。

### `interaction_slots`

会話機会を表す汎用枠。

- `id`
- `tenant_id`
- `service_type`
- `event_id`
- `source`: `seating_pair | self_reported | operator_import`
- `source_ref`
- `round_no`
- `starts_at`
- `ends_at`
- `status`: `active | cancelled`
- timestamps

制約:

- UNIQUE `(tenant_id, event_id, service_type, source, source_ref)`
- UNIQUE `(tenant_id, event_id, service_type, id)`
- FK `(tenant_id, event_id)` → events
- 同じsourceを再処理しても同じslotになる。

### `interaction_slot_participants`

slotに参加した参加者を表す。

- `tenant_id`
- `event_id`
- `service_type`
- `interaction_slot_id`
- `participant_id`
- `role_code` nullable
- timestamps

制約:

- UNIQUE `(tenant_id, event_id, service_type, interaction_slot_id, participant_id)`
- FK `(tenant_id, event_id, service_type, interaction_slot_id)` → slot scope
- FK participant scope
- actorとtargetは両方とも同じslotに存在しなければならない。

一つのテーブルで複数人が会話する場合にも対応するため、slot自体を2名固定にはしない。

### `interaction_notes`

- `id`
- `tenant_id`
- `service_type`
- `event_id`
- `snapshot_id`
- `actor_participant_id`
- `target_participant_id`
- `interaction_slot_id`
- `feeling_code`
- `favorite`
- `revision`
- `recorded_at`
- timestamps

制約:

- CHECK `actor_participant_id <> target_participant_id`
- UNIQUE `(tenant_id, event_id, service_type, snapshot_id, actor_participant_id, target_participant_id, interaction_slot_id)`
- FK actor participant scope
- FK target participant scope
- FK slot scopeは`service_type`を含め、actorとtargetのslot membershipをそれぞれ複合FKで保証
- FK option `(tenant_id, event_id, service_type, snapshot_id, feeling_code)`
- `revision >= 1`

## 競合と冪等性

- APIはPUTを使用し、同じsnapshot・slot・targetへの保存をupsertする。
- 新しいsnapshotを有効化した場合も旧snapshotのメモは変更せず、新snapshot側に別行として保存する。
- クライアントは`expected_revision`を送る。
- revision不一致は409 `REVISION_CONFLICT`。
- 同じ値・同じrevisionの再送は現在値を返し、重複行を作らない。
- 二重タップで複数行が作られないことをunique制約で保証する。

## 立食イベント

現行データから会話相手を自動判定できない。次のいずれかをイベントsnapshotの`target_source`として選ぶ必要がある。

1. `self_reported`: 本人が会話相手番号を短い前方一致で選択し、会話枠を作成する。
2. `operator_import`: 運営が会話ペアCSVを投入する。
3. 将来方式: 相手QR読取等。N1対象外。

2026-08-08の立食では、入力負荷の少ない`self_reported`が実装候補だが、誤選択取消と接触回避除外を含むクライアント承認が必要である。

## migration方針

- 新規migration 0017以降として作成する。0016以前を変更しない。
- nullable追加や既存データbackfillは不要。
- featureを無効のままmigration適用できる後方互換構造にする。
- empty DB適用、同一scope INSERT成功、cross-tenant/event/service/participant拒否を結合テストする。
