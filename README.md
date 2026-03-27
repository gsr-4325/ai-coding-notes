# ai-coding-notes

このリポジトリは、AI を使ったコーディング中のつまずきポイント、調査メモ、解決ログを GitHub Pages で公開するための公開サイト用リポジトリです。記事本文の正本は `notes-drafts` 側で管理し、このリポジトリでは公開用の構造、テンプレート、見た目、表示ロジックを管理します。

## 何をするリポジトリか
- 公開サイトの構造を持つ。
- GitHub Pages に公開するコンテンツを持つ。
- テンプレート、共通 CSS、共通 JavaScript を持つ。
- 記事一覧やトップページの表示ロジックを持つ。
- `notes-drafts` の `published/` から同期された記事を配信する。

## 基本方針
- 記事本文の正本は `notes-drafts` に置く。
- このリポジトリでは公開用コンテンツとテンプレートを管理する。
- 公開記事の本文は原則として `notes-drafts` 側で更新し、このリポジトリへ同期する。
- テンプレートは複数保持できる構成にし、後から切り替えやすくする。

## ディレクトリ構成

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
- テンプレートは HTML に相当するレイアウトだけでなく、CSS と JavaScript も含む。
- 複数テンプレートを `templates/` 配下に並べて置く。
- 共通の土台になる CSS と JavaScript は `templates/_base/` に置く。
- テンプレート固有のレイアウト、部品、CSS、JavaScript は `templates/<template-name>/` に置く。
- どのテンプレートを使うかは `config/site.json` の `activeTemplate` で切り替える想定とする。

## 今の想定テンプレート
- `default`: 技術ブログ向けの標準テンプレート。
- `minimal`: できるだけシンプルな表示に寄せたテンプレート。

## content 配下の役割
- `content/posts/`: 公開記事を置く場所。
- `content/pages/`: トップページや固定ページを置く場所。
- `content/shared-assets/`: サイト共通の公開アセットを置く場所。

## `notes-drafts` との関係
- 下書き、改稿、公開中記事の正本は `notes-drafts` にある。
- `notes-drafts/<site-name>/published/` の内容を、このリポジトリの `content/posts/` へ同期する運用を想定する。
- 内部リンクの `[[slug]]` は同期またはビルド時に公開用リンクへ解決する想定とする。

## 今後追加するもの
- GitHub Pages 公開用のビルドまたは同期 workflow。
- 記事一覧の生成ロジック。
- トップページ。
- テンプレートごとのレイアウト実装。
- 内部リンク解決ロジック。

## 運用メモ
- テンプレート切り替えをしやすくするため、共通資産とテンプレート固有資産は分けて保つ。
- 記事本文はできるだけこのリポジトリで直接編集しない。
- サイトの見た目や UI はこのリポジトリで進化させる。
