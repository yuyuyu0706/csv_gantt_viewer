// headers.js
// @ts-check

/**
 * ヘッダー行の正規化：
 * - 先頭BOM除去
 * - 全角スペース→半角
 * - trim
 * - 小文字化
 * @param {unknown[]} r0
 * @returns {string[]}
 */

export function normHeaders(r0){
  return r0.map(h =>
    String(h||'')
      .replace(/^\ufeff/, '')      // BOM除去
      .replace(/[　]/g,' ')        // 全角スペース→半角
      .trim()
      .toLowerCase()
  );
}

/**
 * 同義語の配列（または 'a|b|c' 文字列）から、header 内で最初に一致した列のindexを返す。
 * 見つからなければ -1。header は normHeaders 済みの小文字配列を想定。
 * @param {string[]|string} names
 * @param {string[]} header
 * @returns {number}
 */
export function findHeaderIndex(names, header){
  const keys = Array.isArray(names)?names:names.split('|');
  for(const k of keys){
    const i = header.indexOf(k.toLowerCase());
    if(i >= 0) return i;
  }
  return -1;
}

