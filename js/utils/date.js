// date.js
// @ts-check

/** 1日のミリ秒（正確値） */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 入力を UTC-真夜中 の Date に正規化して返す。
 * 文字列は YYYY-MM-DD / YYYY/MM/DD を想定。空や不正は null。
 * @param {unknown} x
 * @returns {Date|null}
 */
 
export function toDate(x) {
  if (x == null || x === '') return null;

  if (x instanceof Date) {
    if (isNaN(+x)) return null;
    return new Date(Date.UTC(
      x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()
    ));
  }

  const s = String(x).trim().replace(/\//g, '-');
  const d = new Date(s);
  if (isNaN(+d)) return null;

  return new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()
  ));
}

/**
 * UTCで 'YYYY-MM-DD' に整形。
 * @param {Date} d
 * @returns {string}
 */

export function fmt(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * UTCで 'M/D' に整形。
 * @param {Date} d
 * @returns {string}
 */
 
export function fmtMD(d) {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${m}/${day}`;
}

/**
 * 2つの日付の**包含**日数（両端含む）を返す。UTC基準。
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */

export function daysBetween(a, b) {
  // 念のためUTC真夜中に丸め直して計算
  const ax = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bx = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((bx - ax) / MS_PER_DAY) + 1;
}

