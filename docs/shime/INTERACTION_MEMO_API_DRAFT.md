# ワンタップメモ API案

更新日: 2026-08-05  
状態: N0契約案。API未実装

## 共通

- 参加者APIは`participantHandler`を使用する。
- URLのevent IDとsessionのtenant/user/participantをサーバーで照合する。
- responseは成功 `{ data }`、失敗 `{ code, message?, request_id? }`。
- `Cache-Control: no-store`を設定する。
- 相手の氏名、連絡先、LINE ID、相手側メモ、被選択数を返さない。

## 設定と対象一覧

### `GET /api/liff/events/:eventId/interaction-memo`

返却:

```json
{
  "data": {
    "enabled": true,
    "editableUntil": "2026-08-08T07:00:00.000Z",
    "options": [
      { "code": "reassured", "label": "安心した", "displayOrder": 1 }
    ],
    "targets": [
      {
        "interactionSlotId": "opaque-uuid",
        "targetParticipantId": "opaque-uuid",
        "participantNumber": "B03",
        "roundNo": 1,
        "note": {
          "feelingCode": "reassured",
          "favorite": false,
          "revision": 2,
          "savedAt": "2026-08-08T05:10:00.000Z"
        }
      }
    ]
  }
}
```

検証:

- snapshot有効・期間内
- actorは参加確定または来場済み
- targetは同一slot、tenant、event
- actor自身、取消、欠席、接触回避を除外
- 生メモはactor本人分だけ返す

## 自動保存

### `PUT /api/liff/events/:eventId/interaction-memo/:slotId/:targetParticipantId`

request:

```json
{
  "feelingCode": "reassured",
  "favorite": true,
  "expectedRevision": 2
}
```

response:

```json
{
  "data": {
    "feelingCode": "reassured",
    "favorite": true,
    "revision": 3,
    "savedAt": "2026-08-08T05:11:00.000Z"
  }
}
```

ルール:

- feelingは主タグ1つ。
- favoriteは独立boolean。
- feelingを変更しても同じ行を更新する。
- 更新前にslot membership、接触回避、参加状態、期間を再検証する。
- raw requestをログへ出さない。

## 立食の会話相手追加候補

### `GET /api/liff/events/:eventId/interaction-memo/target-candidates?q=B`

- `target_source=self_reported`のイベントだけ有効。
- 参加者番号の前方一致のみ。氏名検索と氏名返却は行わない。
- checked-inかつ有効な相手を最大10件返す。
- actor自身、接触回避、既登録slotを除外する。

### `POST /api/liff/events/:eventId/interaction-memo/slots`

request:

```json
{ "targetParticipantId": "opaque-uuid" }
```

- 本人確認画面を経て作成する。
- 同じactor/target/eventの短時間二重送信は同じslotを返す。
- 誤選択取消はメモ未入力時のみ許可する案とし、正式決定が必要。

## エラーコード

| code | HTTP | 意味 |
|---|---:|---|
| `INTERACTION_MEMO_DISABLED` | 409 | イベントで無効 |
| `INTERACTION_MEMO_NOT_OPEN` | 409 | 利用期間外 |
| `INTERACTION_TARGET_NOT_ALLOWED` | 404 | slot外、他event、回避対象等を区別せず非公開 |
| `INVALID_FEELING_CODE` | 400 | snapshotに存在しない |
| `REVISION_CONFLICT` | 409 | 別端末・古い画面との競合 |
| `PARTICIPATION_NOT_CONFIRMED` | 409 | 参加状態が対象外 |
| `UNAUTHORIZED` | 401 | participant sessionなし |

## 管理API

N1では生メモ一覧APIを作らない。

設定管理はmanager/system_admin向けに、snapshot作成・適用・無効化だけを提供する。集計はN3で本人向けに追加し、スタッフ向けの個人別集計は追加しない。

