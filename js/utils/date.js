// date.js
// @ts-check

// app.js の toDate / fmt / fmtMD / daysBetween を移植:contentReference[oaicite:9]{index=9}
export function toDate(x){
  if(!x) return null;
  const t=String(x).trim().replace(/\//g,'-');
  const d=new Date(t);
  return isNaN(d) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const fmt  = (d)=> d.toISOString().slice(0,10);

export function fmtMD(date){
  if(!date) return '';
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${m}/${d}`;
}

export const daysBetween = (a,b)=> Math.floor((b-a)/86400000)+1;
