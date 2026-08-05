# ワンタップメモ N0決定事項

更新日: 2026-08-05

## 確定した技術方針

| ID | 決定 | 理由 |
|---|---|---|
| IM-01 | interaction moduleを新設する | 既存希望・診断と公開範囲、期限、目的が異なる |
| IM-02 | `conversation_pairs`は読取元として維持し、意味やschemaを変更しない | 既存席・希望機能への回帰を避ける |
| IM-03 | `interaction_slots`を新設する | 複数回、立食、将来イベントを表現するため |
| IM-04 | 選択肢はイベント別の不変snapshotにする | 過去イベント再現と文言変更の分離 |
| IM-05 | 主タグ1つ＋favorite booleanをN1 MVPとする | 更新仕様のMVPに一致 |
| IM-06 | 生メモはparticipant本人APIだけで扱う | 一方評価とセンシティブ情報を保護 |
| IM-07 | 希望を自動選択・提出しない | 本人の明示操作を維持 |
| IM-08 | AI、通知、人気集計、ラスト3分、チャットをN1から除外する | Phase分離と本番安全性 |
| IM-09 | 機能は既定OFFにする | 既存v1/v2と8月8日導線を無断変更しない |
| IM-10 | raw feelingと相手情報を監査ログへ複製しない | 漏えい面積を増やさない |
| IM-11 | PUT＋revisionで自動保存する | 二重タップ冪等性と別端末競合を両立 |
| IM-12 | 通常スタッフ向け生メモ一覧を作らない | reception/operator/managerの職務に不要 |
| IM-13 | tenant・eventに加えてservice_typeを全snapshot・slot・noteのscopeへ含める | SHIME OSの別service間で設定や記録を混在させない |
| IM-14 | noteの一意性にsnapshot_idを含める | 新snapshot公開後も旧版メモを不変のまま保持し、新版の入力と競合させない |

## N1開始前に必要な判断

| ID | 確認事項 | 推奨案 | 未確定時の扱い |
|---|---|---|---|
| IM-D01 | 立食イベントの会話相手登録方式 | 参加者番号前方一致＋本人確認によるself-report | 立食では機能OFF |
| IM-D02 | 「ご縁なし」の正式表示文 | 現仕様のまま。内部codeは`no_connection`固定 | テンプレート下書きのみ |
| IM-D03 | 利用終了後の編集可否 | event endまで編集、以降読取のみ | 保存APIを閉じる |
| IM-D04 | 生メモ保存期間 | eventの`retentionDays`に従う | 自動削除jobは後続 |
| IM-D05 | 誤った立食相手の取消 | メモ未入力なら取消可、入力後は対象を非表示にせず修正不可 | slot作成APIを公開しない |
| IM-D06 | break-glass閲覧 | N1では不可 | 専用APIを作らない |
| IM-D07 | 8月8日本番で有効化するか | migration・実機UAT・代替運用完了まではOFF | releaseへマージしてもOFF |

## N1の実装範囲

- option snapshot
- interaction slotとslot participant
- interaction note
- Repository interfaceとDrizzle実装
- participant本人用取得・PUT UseCase
- API
- 最小audit
- unit、integration、contract test
- empty DB migrationとcross-scope拒否test

## N1で実装しないもの

- 参加者UI（N2）
- 本人向け集計（N3）
- ラスト3分（N4）
- 終了後統合（N5）
- 3日チャット（N6）
- AI順位付け
- 他人からの評価表示
- 人気順位・被投票数
- LINE通知
- production migration・deploy

## N0完了判定

- 現行会話相手データの利用範囲を特定した。
- 立食イベントでは新しい対象登録方式が必要と判定した。
- preferences/matchingとの責務を分離した。
- 最小DB、API、UI、安全境界を文書化した。
- N1の実装範囲と未決事項を分離した。

N0は完了。次の作業はIM-D01〜D07を承認可能な状態に整理したうえで、別PRのN1基盤へ進むことである。
