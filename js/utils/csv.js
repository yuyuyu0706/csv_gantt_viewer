// csv.js
// @ts-check

/**
 * 既存 app.js の parseCSV をそのまま移植:contentReference[oaicite:8]{index=8}
 * @param {string} text
 * @returns {string[][]}
 */

export function parseCSV(text){
  const rows = []; let i=0, f='', row=[], q=false;
  const s = String(text||'').replace(/\r\n?/g,'\n');
  while(i<s.length){
    const c=s[i];
    if(q){
      if(c === '"'){
        if(s[i+1] === '"'){ f+='"'; i++; }
        else { q=false; }
      }else{ f+=c; }
    }else{
      if(c === '"'){ q=true; }
      else if(c === ','){ row.push(f.trim()); f=''; }
      else if(c === '\n'){ row.push(f.trim()); rows.push(row); row=[]; f=''; }
      else { f+=c; }
    }
    i++;
  }
  if(f.length>0 || row.length>0){ row.push(f.trim()); rows.push(row); }
  return rows.filter(r=>r.some(x=>x!==''));
}
