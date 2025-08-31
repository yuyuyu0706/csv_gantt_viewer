// dom.js
export const $  = (s)=>document.querySelector(s);
export const $$ = (s)=>document.querySelectorAll(s);

export function createEl(tag, className, text){
  const el = document.createElement(tag);
  if(className) el.className = className;
  if(text != null) el.textContent = text;
  return el;
}
