// dom.js
// @ts-check

/**
 * CSSセレクタに一致する最初の要素（なければ null）
 * @template {Element} T
 * @param {string} selector
 * @returns {T|null}
 */
export const $  = (selector)=>document.querySelector(selector);

/**
 * CSSセレクタに一致する全要素の NodeList
 * @template {Element} T
 * @param {string} selector
 * @returns {NodeListOf<T>}
 */
export const $$ = (selector)=>document.querySelectorAll(selector);

/**
 * 要素を作成（className と text は任意）
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [className]
 * @param {string|number|null} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createEl(tag, className, text){
  const el = document.createElement(tag);
  if(className) el.className = className;
  if(text != null) el.textContent = String(text);
  return el;
}

/**
 * 必ず存在する要素を取得（無ければ例外）
 * @template {Element} T
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {T|null}
 */
export function mustQuery(selector, root = document) {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  // @ts-ignore - JSDocキャスト
  return /** @type {T|null} */ (el);
}

/**
 * 存在しないかもしれない要素（null可）
 * @template {Element} T
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {T|null}
 */
export function maybeQuery(selector, root = document) {
  // @ts-ignore
  return /** @type {T|null} */ (root.querySelector(selector));
}

/**
 * id 取得（必須）
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
export function mustById(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  // @ts-ignore
  return /** @type {T} */ (el);
}

/**
 * currentTarget を型安全に取り出す
 * @template {HTMLElement} T
 * @param {Event} e
 * @returns {T}
 */
export function ct(e) {
  // @ts-ignore
  return /** @type {T} */ (e.currentTarget);
}

