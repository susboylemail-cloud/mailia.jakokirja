#!/usr/bin/env node
/*
Refined duplicate scanner for circuit CSVs.
Focuses strictly on address fields to avoid false positives from product/name columns.

Supported formats:
- Legacy: "Sivu","Katu","Osoite","Nimi","Merkinnät" (we use Katu + building number extracted from Osoite)
- New: Katu,Osoitenumero,Porras/Huom,Asunto,Tilaaja,Tilaukset (we use Katu + Osoitenumero [+ Porras + Asunto] )

Outputs:
- duplicates-report.json: structured data with per-circuit and cross-circuit duplicates at building and unit level
- duplicates-report.md: human-friendly summary
*/
const fs = require('fs');
const path = require('path');

const CIRCUIT_DIR = process.cwd();
const OUTPUT_JSON = path.join(CIRCUIT_DIR, 'duplicates-report.json');
const OUTPUT_MD = path.join(CIRCUIT_DIR, 'duplicates-report.md');

function isCSV(filename){ return filename.toLowerCase().endsWith('.csv'); }

function detectFormat(headerFields){
  const lower = headerFields.map(f => f.toLowerCase());
  // Legacy
  if (lower.includes('sivu') && lower.includes('katu') && lower.includes('osoite')) return 'legacy';
  // New
  if (lower.includes('katu') && lower.includes('osoitenumero')) return 'new';
  return 'unknown';
}

function parseCsvLine(line){
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map(s => s.replace(/^\"|\"$/g,'').trim());
}

function parseCSV(content){
  const lines = content.split(/\r?\n/).filter(l=>l.trim().length>0);
  if (lines.length === 0) return { format: 'empty', rows: [], header: [] };
  const headerFields = parseCsvLine(lines[0]);
  const format = detectFormat(headerFields);

  const idx = (name) => headerFields.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const raw = lines[i];
    const parts = parseCsvLine(raw);
    if (format === 'legacy'){
      const katu = parts[idx('Katu')] ?? '';
      const osoite = parts[idx('Osoite')] ?? '';
      rows.push({ format, katu, osoite, raw });
    } else if (format === 'new') {
      const katu = parts[idx('Katu')] ?? '';
      const number = parts[idx('Osoitenumero')] ?? '';
      const porras = parts[idx('Porras/Huom')] ?? '';
      const asunto = parts[idx('Asunto')] ?? '';
      rows.push({ format, katu, number, porras, asunto, raw });
    } else {
      // Unknown: try to use first two columns as street/number
      rows.push({ format, katu: parts[0] ?? '', number: parts[1] ?? '', raw });
    }
  }
  return { format, rows, header: headerFields };
}

const collapse = (s) => (s||'').toLowerCase().normalize('NFC').replace(/\s+/g,' ').trim();
const compactNum = (s) => collapse(s).replace(/\s+/g,''); // 15 A -> 15a
function extractLegacyNumber(osoite){
  const m = (osoite||'').match(/^(\s*)(\d+\s*[a-zA-Z]?)/);
  return m ? compactNum(m[2]) : compactNum(osoite||'');
}
function buildingKey(rec){
  if (rec.format === 'new') {
    return `${collapse(rec.katu)} ${compactNum(rec.number)}`.trim();
  }
  if (rec.format === 'legacy') {
    return `${collapse(rec.katu)} ${extractLegacyNumber(rec.osoite)}`.trim();
  }
  // fallback
  if (rec.katu && rec.number) return `${collapse(rec.katu)} ${compactNum(rec.number)}`;
  if (rec.osoite) return collapse(rec.osoite);
  return collapse(rec.raw||'');
}
function unitKey(rec){
  const b = buildingKey(rec);
  if (rec.format === 'new') {
    const porras = compactNum(rec.porras||'');
    // remove common prefixes like "as", "as.", whitespace
    const asunto = compactNum((rec.asunto||'').replace(/^as\.?\s*/i,''));
    return `${b}|${porras}|${asunto}`;
  }
  // Legacy has no separate apartment -> unit key falls back to building
  return b;
}

function scan(){
  const entries = fs.readdirSync(CIRCUIT_DIR);
  const csvFiles = entries.filter(isCSV);
  const globalBuildingMap = new Map(); // buildingKey -> occurrences across circuits
  const globalUnitMap = new Map(); // unitKey -> occurrences across circuits
  const perCircuit = {}; // circuit -> summary

  csvFiles.forEach(file => {
    const full = path.join(CIRCUIT_DIR, file);
    const content = fs.readFileSync(full,'utf8');
    const { format, rows } = parseCSV(content);
    const circuitId = path.basename(file).replace(/\s*DATA|\.csv/gi,'').replace(/\s+/g,'').toUpperCase();
    const bMap = new Map();
    const uMap = new Map();
    rows.forEach((r, idx) => {
      const bKey = buildingKey(r);
      if (bKey) {
        const arr = bMap.get(bKey) || [];
        arr.push({ index: idx+1, raw: r.raw });
        bMap.set(bKey, arr);
        const gArr = globalBuildingMap.get(bKey) || [];
        gArr.push({ circuit: circuitId, file, index: idx+1 });
        globalBuildingMap.set(bKey, gArr);
      }
      const uKey = unitKey(r);
      if (uKey) {
        const arrU = uMap.get(uKey) || [];
        arrU.push({ index: idx+1, raw: r.raw });
        uMap.set(uKey, arrU);
        const gArrU = globalUnitMap.get(uKey) || [];
        gArrU.push({ circuit: circuitId, file, index: idx+1 });
        globalUnitMap.set(uKey, gArrU);
      }
    });
    const dupB = [...bMap.entries()].filter(([,list]) => list.length > 1);
    const dupU = [...uMap.entries()].filter(([,list]) => list.length > 1);
    perCircuit[circuitId] = {
      file,
      format,
      total: rows.length,
      uniqueBuildings: bMap.size,
      duplicateBuildings: dupB.length,
      duplicateUnits: dupU.length,
      duplicatesByBuilding: dupB.map(([k,list])=>({ key: k, occurrences: list.length, examples: list.slice(0,5) })),
      duplicatesByUnit: dupU.map(([k,list])=>({ key: k, occurrences: list.length, examples: list.slice(0,5) })),
    };
  });

  const globalBuildingDuplicates = [...globalBuildingMap.entries()].filter(([,list]) => list.length > 1)
    .map(([key,list]) => ({ key, totalOccurrences: list.length, circuits: [...new Set(list.map(l=>l.circuit))], examples: list.slice(0,10) }));
  const globalUnitDuplicates = [...globalUnitMap.entries()].filter(([,list]) => list.length > 1)
    .map(([key,list]) => ({ key, totalOccurrences: list.length, circuits: [...new Set(list.map(l=>l.circuit))], examples: list.slice(0,10) }));

  return { perCircuit, globalBuildingDuplicates, globalUnitDuplicates, generatedAt: new Date().toISOString(), csvCount: Object.keys(perCircuit).length };
}

function writeReports(data){
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data,null,2),'utf8');
  const lines = [];
  lines.push(`# Duplicate Address Report`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`CSV Files Scanned: ${data.csvCount}`);
  lines.push(``);
  lines.push(`## Global Building Duplicates Across Circuits (${data.globalBuildingDuplicates.length})`);
  data.globalBuildingDuplicates.slice(0,150).forEach(d => {
    lines.push(`- ${d.key} -> ${d.totalOccurrences} occurrences across: ${d.circuits.join(', ')}`);
  });
  lines.push('');
  lines.push(`## Global Unit Duplicates Across Circuits (${data.globalUnitDuplicates.length})`);
  data.globalUnitDuplicates.slice(0,150).forEach(d => {
    lines.push(`- ${d.key} -> ${d.totalOccurrences} occurrences across: ${d.circuits.join(', ')}`);
  });
  lines.push(``);
  lines.push(`## Per-Circuit Summary`);
  Object.entries(data.perCircuit).forEach(([cid, info]) => {
    lines.push(`### ${cid}`);
    lines.push(`File: ${info.file}`);
    lines.push(`Format: ${info.format}`);
    lines.push(`Rows: ${info.total}, Unique buildings: ${info.uniqueBuildings}, Duplicate buildings: ${info.duplicateBuildings}, Duplicate units: ${info.duplicateUnits}`);
    if (info.duplicatesByBuilding.length) {
      lines.push(`- Building duplicates:`);
      info.duplicatesByBuilding.slice(0,50).forEach(d => lines.push(`  - ${d.key} (${d.occurrences})`));
    }
    if (info.duplicatesByUnit.length) {
      lines.push(`- Unit duplicates:`);
      info.duplicatesByUnit.slice(0,50).forEach(d => lines.push(`  - ${d.key} (${d.occurrences})`));
    }
    if (!info.duplicatesByBuilding.length && !info.duplicatesByUnit.length) {
      lines.push(`- No duplicates in this circuit.`);
    }
    lines.push('');
  });
  fs.writeFileSync(OUTPUT_MD, lines.join('\n'),'utf8');
}

(function main(){
  try {
    const data = scan();
    writeReports(data);
    const globalBuildingDupCount = data.globalBuildingDuplicates.length;
    const globalUnitDupCount = data.globalUnitDuplicates.length;
    console.log(`Scanned ${data.csvCount} CSV files.`);
    console.log(`Global building duplicates: ${globalBuildingDupCount}`);
    console.log(`Global unit duplicates: ${globalUnitDupCount}`);
    const worstCircuits = Object.entries(data.perCircuit)
      .map(([cid,info]) => ({ cid, count: (info.duplicateBuildings||0) + (info.duplicateUnits||0) }))
      .sort((a,b)=>b.count-a.count)
      .slice(0,10);
    console.log('Top circuits by duplicate addresses:');
    worstCircuits.forEach(w => console.log(`  ${w.cid}: ${w.count}`));
    console.log(`Detailed reports written to ${OUTPUT_JSON} and ${OUTPUT_MD}`);
  } catch (e) {
    console.error('Duplicate scan failed:', e);
    process.exit(1);
  }
})();
