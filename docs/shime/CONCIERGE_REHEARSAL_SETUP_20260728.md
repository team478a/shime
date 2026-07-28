# Concierge Phase 1B staging実機確認準備

実施日: 2026-07-28
対象環境: staging
対象イベント: `rh-a-20260715`
判定: **合成診断設定の準備完了・参加者向け公開はOFF**

## 実施内容

- staging・RH形式イベントだけを対象にできる準備スクリプトを追加した。
- 既定動作は読み取り専用dry-runとし、`--apply`を明示しない限り変更しない。
- 合成カード画像8枚を生成し、既存の画像安全化処理でWebPへ再エンコードした。
- private Supabase Storageへimmutable objectとして保存した。
- カード資産8件・公開版8件を作成した。
- 4分析軸、8感情、8カードmappingを持つ検証専用テンプレートv1を公開状態で作成した。
- RH-Aへイベント専用スナップショットを適用した。
- 作成・適用操作を監査ログへ記録した。
- 診断設定は`enabled=false`、利用期間なし、再回答不可のまま維持した。
- LINE通知、外部AI、実参加者データは使用していない。

## 安全条件

準備スクリプトは次をすべて満たさない場合に停止する。

- `APP_ENV=staging`
- イベントコードが`rh-[a-z]-YYYYMMDD`
- イベント状態が`draft`または`accepting`
- 有効なsystem administratorが同一tenantに存在する
- 適用前の診断スナップショットがOFF
- Concierge Storage bucketがprivate
- 既存の検証テンプレートと8カードmappingが一致

本番イベントコードやproduction環境には使用できない。

## 実行結果

dry-run（適用前）:

```text
assets: 0
published cards: 0
published templates: 0
event snapshots: 0
enabled snapshots: 0
```

適用:

```text
cards created: 8
template created: true
snapshot ready: true
diagnosis enabled: false
```

適用後の読み取り専用確認:

```text
snapshot valid: true
questions: 4
emotions: 8
cards: 8
published cards: 8
diagnosis enabled: false
participant diagnosis sessions: 0
private storage bucket: ready
```

## コマンド

読み取り専用:

```text
pnpm rehearsal:prepare-concierge --event-code rh-a-20260715
```

staging適用:

```text
pnpm rehearsal:prepare-concierge --apply --event-code rh-a-20260715
```

## 次の実機確認

1. staging管理画面へログインする。
2. RH-Aの「診断テンプレート適用」を開く。
3. 現在の版、4名対象、診断OFFを確認する。
4. 利用期間を実機確認時間だけに限定し、SHIME診断をONにする。
5. 既に本人連携済みのRH-A合成参加者で診断画面を開く。
6. 選択前にカード表面情報が見えないことを確認する。
7. 1枚を選び、選択済みカードだけ画像・名称・メッセージが表示されることを確認する。
8. 途中保存、再読込、4問回答、確認、提出、結果表示を確認する。
9. 別参加者の回答・カード・結果が見えないことを確認する。
10. 終了後、管理画面で診断をOFFへ戻す。

実機確認が完了するまで、Conciergeを本番利用可能とは判定しない。
