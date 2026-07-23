# SHIME® Concierge Phase 1A 追加確定要件

- 確定日: 2026-07-23
- 対象Phase: Concierge Phase 1A
- 状態: 承認済み要件
- 実装状態: 未実装
- 注意: 本書はPhase 1Aの受入条件を追加するものであり、Phase 1Aの実装開始を承認するものではない。

## 1. カード画像の差し替え

カード画像の差し替えは、既存画像objectの上書きとして扱わない。

次を新規作成する。

- 新しい画像asset
- 新しい画像asset version
- 新しいcard version

旧画像と旧card versionは、進行中・終了済みイベントおよび過去の回答・レポートを再現するため保持する。通常の削除操作は物理削除ではなくarchiveとする。

公開済みsnapshotから参照されている画像assetとcard versionは物理削除できない。

## 2. 公開済みカードとテンプレート

公開済みカードに対する次の変更は、公開中のtemplateを直接更新せず、新しいtemplate versionとして作成する。

- カード追加
- カード削除
- 並び替え
- カード名・メッセージ等の文言変更
- 画像変更
- 感情mapping変更
- 利用設定変更

下書き中のversionは編集できる。公開済みversionはimmutableとし、変更時は「新version作成」操作を使用する。

イベントへ適用した時点のtemplate、card、画像、表示順、mapping、表示文をevent snapshotへ保存する。

## 3. AIレポート関連設定のPhase境界

Concierge Phase 1Aでは、次の項目を設定、保存、版管理できるようにする。

- レポートタイトル
- レポート項目見出し
- SHIME®固定メッセージ
- 免責文
- 注意事項
- 次の行動への案内文
- 次サービスへの導線文言

Concierge Phase 1Aでは、次を実装しない。

- 外部AI Provider接続
- AI生成
- AI job
- AI再試行
- AI fallback処理
- AI利用上限・課金管理

これらはD-08とD-09の確定後、Concierge Phase 2で実装する。

Phase 1Aの管理画面に「AI生成を実行する」操作を表示しない。Phase 1Aで保存した設定は、Phase 2が有効になるまで参加者向けAI処理に利用しない。

## 4. 自由編集できない表示文

次の領域の表示文は管理画面の自由入力対象にしない。

- 認証
- 権限
- 本人確認
- 個人情報
- AI処理同意
- システムエラー
- セキュリティ警告

これらは次のいずれかで管理する。

1. 開発側が管理する安全な固定文
2. 開発側が事前承認した表示文keyからの選択

表示文keyはcode側のallowlistと対応させる。管理者が任意のHTML、URL、script、個人情報入力要求等を設定できないようにする。

一般的な診断説明、案内、ボタンlabel等を編集可能にする場合も、文字数、利用可能文字、URL、markupをschemaで制限し、安全なcode fallbackを必須とする。

## 5. カード画像アップロード検証

正式保存前に、server側で次を検証する。

- 許可拡張子
- 宣言されたMIME type
- 実ファイルsignature
- 実画像としてのdecode可否
- 最大ファイルサイズ
- 最小・最大の幅と高さ
- 最大総pixel数
- content hash
- 同一tenant内の重複
- 破損
- 不正形式

client側の検証だけを安全性の根拠にしない。

検証後、次を行う。

- EXIF等のmetadataを除去
- 許可された安全な形式へ再encode
- 再encode後のMIME type、寸法、容量、hashを記録
- private Storageへ保存
- tenant、module、asset、versionを含む正規化object keyを使用

参加者画面では認証済み画像配信APIまたは短時間の署名URLを使用し、恒久的な公開URLをDBへ保存しない。

初期推奨値は、最大5MB、最低512×512px、推奨WebPとする。最大幅・高さ、最大総pixel数、署名URL有効時間はPhase 1A実装開始時に既存環境を確認して決定する。

## 6. Template公開時の完全性検証

`draft`では、不完全な途中保存を許可する。

`published`へ変更する際は、server側で最低限次を検証する。

### 設問

- 4つの分析軸がすべて存在する
- 各分析軸に有効な設問が1つ以上存在する
- 各設問の種類、必須性、表示順が有効である
- 選択式設問には有効な選択肢がある
- option codeと表示順がversion内で重複しない

正式な4分析軸codeはD-06とPhase 1A schema確定時に定義する。

### 感情

次の8つの内部codeが、すべて重複なく有効である。

```text
trust
fear
surprise
sadness
disgust
anger
anticipation
joy
```

- 内部codeは管理画面から変更できない
- 各codeに空でない表示labelがある
- 表示順が重複しない
- 必要なcardまたはmappingが有効である

### Snapshot対象

公開およびイベント適用時に、次のversionとhashを記録する。

- diagnosis template version
- question・option version
- emotion label version
- card set version
- card version
- image asset version
- AI report表示設定version
- snapshot schema version
- snapshot hash

不足または不整合があるtemplateは公開できない。管理画面には不足項目を具体的に表示するが、private dataや内部例外messageは表示しない。

## 7. 受入条件への追加

- 画像差し替え後も旧画像を参照する過去snapshotが変化しない
- 公開済みversionをupdateするAPIが存在しない、またはserver側で拒否される
- Phase 1Aでは外部AIへの通信が発生しない
- 保護対象文言へ任意文字列を保存できない
- 拡張子だけを偽装したファイルを拒否する
- MIME typeだけを偽装したファイルを拒否する
- decode不能、過大pixel、破損画像を拒否する
- metadata除去と安全な再encode後の画像だけを正式保存する
- 不完全なdraftを保存できる
- 不完全なdraftを公開できない
- 4分析軸と8感情codeが完全なversionだけを公開できる
- publish、archive、新version作成、event適用を監査する
- tenant/eventを越えたasset、template、snapshot参照を拒否する

## 8. 未決事項との関係

本書により確定したのは、版管理、画像安全性、Phase境界、保護対象文言、公開完全性の実装要件である。

次は引き続き未確定である。

- D-01: 2026-08-08本番でConciergeを利用するか
- D-02: Dreamと診断の順序・必須／任意
- D-03: templateの所有・共有範囲
- D-05: 8感情の正式表示label
- D-06: 4問の正式文言・選択肢・必須性・提出後修正
- D-07: 診断原文の閲覧権限と利用目的

D-04の事業要件は「Dreamと診断でカード画像・名称・メッセージの資産を共有し、用途別設定と回答は分離する」とする。ただし、既存`emotion_cards`の意味を変更しないための物理schemaはPhase 1A開始時の設計レビューで確定する。

## 9. 開始ゲート

本書の確定だけではConcierge Phase 1Aを開始しない。

開始には次が必要である。

1. D-01〜D-07の確定
2. `CONCIERGE_GAP_ANALYSIS.md`と`CONCIERGE_IMPLEMENTATION_PLAN.md`の承認
3. 既存Dream cardと共通card assetの移行・互換設計承認
4. Event OS本番P0を妨げない作業計画
5. Concierge Phase 1A開始の別指示
