// headers.js
// @ts-check

// app.js の normHeaders / findHeaderIndex を移植:contentReference[oaicite:10]{index=10}
export function normHeaders(r0){
  return r0.map(h =>
    String(h||'')
      .replace(/^\ufeff/, '')      // BOM除去
      .replace(/[　]/g,' ')        // 全角スペース→半角
      .trim()
      .toLowerCase()
  );
}

export function findHeaderIndex(names, header){
  const keys=Array.isArray(names)?names:names.split('|');
  for(const k of keys){
    const i=header.indexOf(k.toLowerCase());
    if(i>=0) return i;
  }
  return -1;
}

