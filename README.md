# ai-coding-notes

`ai-coding-notes` は AI コーディングの備忘録を公開する GitHub Pages 用の public repository です。

コンテンツの正本は `notes-drafts` に置き、この repository は表示・配信・テンプレート管理を担当します。

## この repository の役割
- GitHub Pages の公開サイト本体を持つ
- テンプレート、レイアウト、共通 CSS、共通 JavaScript を持つ
- トップページ、記事ページ、一覧ページなどの見た目を定義する
- `notes-drafts` の `published/` から同期された記事を配信する
- 公開時に Markdown から静的 HTML を生成する前提で運用する

## 基本方針
- 本文の正本は `notes-drafts`
- この repository は配信用なので、記事本文を直接編集しない
- 本文は Markdown から公開時に HTML へ変換する
- 内部リンクは `[[slug]]` または `[[slug|表示名]]` を解決して生成する
- テンプレートは複数切り替え可能な構成にする

## 想定ディレクトリ構成

```text
ai-coding-notes/
  README.md
  config/
    site.json
  content/
    posts/
    pages/
    shared-assets/
  templates/
    _base/
      assets/
        css/
        js/
    default/
      layouts/
      components/
      assets/
        css/
        js/
    minimal/
      layouts/
      components/
      assets/
        css/
        js/
```

## テンプレートの考え方

### `_base`
- 全テンプレート共通の CSS と JavaScript
- タイポグラフィ、コード表示、内部リンク補助などの基礎部分

### `default`
- 通常の公開用テンプレート
- ナビゲーションや余白を含む標準表示

### `minimal`
- できるだけ軽く読むことを優先したテンプレート
- 表示要素を絞った簡易版

## Markdown → HTML 変換について

この repository では、ブラウザ側 JavaScript で Markdown をその場で HTML 化する方式を主方式にはしません。

代わりに、公開時のビルドまたは同期処理で Markdown を静的 HTML に変換します。

### 理由
- GitHub Pages と相性がよい
- 初回表示が安定する
- 公開前にリンク切れや assets 不足を検査しやすい
- 将来の export や他サービス展開に流用しやすい

## 今後この repository に追加するもの
- 公開用トップページ
- 記事ページ用テンプレート
- 記事一覧生成
- `[[slug]]` 解決ルール
- Markdown 変換スクリプト
- GitHub Actions による同期とビルド
