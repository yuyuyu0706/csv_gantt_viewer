# CSV to Gantt Viewer Green

このリポジトリは CSV をもとにガントチャートを表示するビューアです。

## カテゴリ表示順のカスタマイズ

`config.json` にカテゴリ表示順の設定を記述すると、必要に応じて既定の並びを上書きできます。設定が無効な場合や `config.json` が存在しない場合は、アプリ既定の順序が利用されます。

- `categoryOrderEnabled`: `true` で設定を有効化します。`false` の場合は既定の順番が使われます。
- `categoryOrder`: 表示順に並べたカテゴリ名の配列です。ここに記載されていないカテゴリは既定の並びの末尾に表示されます。

```json
{
  "categoryOrderEnabled": true,
  "categoryOrder": [
    "マイルストーン",
    "PMO",
    "活用 PoC① AIエージェント構築"
  ]
}
```

> **メモ:** `categoryOrder` の配列を空にするか、設定ファイルが取得できない場合は既定値にフォールバックします。

## 開発

```bash
npm install
npm test
```
