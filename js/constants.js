// constants.js
// app.js 先頭の定数とカテゴリ順を集約:contentReference[oaicite:11]{index=11}
export const LEFT_START_PAD_DAYS = 7;
export const ROW_H  = 28;
export const BAR_H  = 20;

export const CATEGORY_ORDER = [
  'マイルストーン',
  'PMO',
  '活用 PoC① AIエージェント構築',
  '活用 PoC② CDP関連',
  '活用 PoC③ VoC分析',
  'データマネジメント①-体制構築',
  'データマネジメント②-ガバナンス',
  'データマネジメント③-セキュリティ',
  'データマネジメント④-メタデータ管理',
  '構築-基盤環境',
  '構築-データ整備・連携',
  '構築-データカタログ整備'
];

export const catRank = (name)=>{ const i=CATEGORY_ORDER.indexOf(name); return i<0? 9999 : i; };

