#!/usr/bin/env node
/*
Deduplicate per-circuit CSV files by collapsing identical addresses.
- Merges product codes and subscriber names for duplicate rows.
- Preserves original row order based on first occurrence.
- Updates CSVs in place (creates no backups). Run under version control to review changes.
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function isCsvFile(name) {
  return name.toLowerCase().endsWith('.csv');
}

function splitCsvRows(text) {
  const rows = [];
  let insideQuotes = false;
  let current = '';
  const sanitized = text.replace(/\ufeff/g, '');

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    const nextChar = sanitized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
        current += char;
      }
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      if (current.length > 0) {
        rows.push(current.replace(/\r/g, ''));
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    rows.push(current.replace(/\r/g, ''));
  }

  return rows.filter(row => row.trim().length > 0);
}

function tokenizeCsvFields(line, delimiter) {
  const fields = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField);
  return fields.map(field => field.replace(/\r/g, ''));
}

function detectFormat(headerFields) {
  const lower = headerFields.map(f => f.toLowerCase());
  if (lower.includes('katu') && lower.includes('osoitenumero')) return 'new';
  if (lower.includes('sivu') && lower.includes('katu') && lower.includes('osoite')) return 'legacy';
  return 'unknown';
}

function cleanAngleBrackets(text) {
  if (!text) return text;
  return text.replace(/<[^>]*>/g, '').trim();
}

function fixRepeatedAddress(address) {
  if (!address) return address;
  const trimmed = address.trim().replace(/\s+/g, ' ');
  const parts = trimmed.split(' ');
  if (parts.length >= 4 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(' ');
    const second = parts.slice(half).join(' ');
    if (first.toUpperCase() === second.toUpperCase()) {
      return first;
    }
  }
  const dupStreet = trimmed.match(/^([A-ZÅÄÖ]+)\s+\1\s+(.*)$/i);
  if (dupStreet) {
    return `${dupStreet[1]} ${dupStreet[2]}`.trim();
  }
  return trimmed;
}

function normalizeAddressForKey(address) {
  if (!address) return '';
  return fixRepeatedAddress(address).toUpperCase().replace(/\s+/g, ' ').trim();
}

function extractProducts(raw) {
  if (!raw) return [];
  const sanitized = raw.replace(/UVES/gi, 'UV ES');
  const segments = sanitized.split(/[;\n,]+/).map(s => s.trim()).filter(Boolean);
  const result = [];
  const seen = new Set();

  function push(code) {
    if (!code) return;
    const normalized = code.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(code);
    }
  }

  segments.forEach(segment => {
    if (segment.includes(' ')) {
      segment.split(/\s+/).forEach(push);
    } else {
      push(segment);
    }
  });

  return result;
}

function appendDistinctName(list, name) {
  if (!name) return;
  const cleaned = cleanAngleBrackets(name).trim();
  if (!cleaned) return;
  const normalized = cleaned.toLowerCase();
  if (!normalized) return;
  const exists = list.some(existing => cleanAngleBrackets(existing).trim().toLowerCase() === normalized);
  if (!exists) {
    list.push(cleaned);
  }
}

function mergeProductLists(target, source) {
  const seen = new Set(target.map(p => p.toUpperCase()));
  source.forEach(product => {
    const normalized = product.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      target.push(product);
    }
  });
}

function serializeFields(fields, delimiter) {
  return fields.map(field => {
    const value = field == null ? '' : String(field);
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(delimiter);
}

function parseLegacyRow(fields) {
  if (fields.length < 5) return null;
  const street = fields[1].trim();
  const rawAddress = fields[2].trim();
  const name = cleanAngleBrackets(fields[3].trim());
  const products = extractProducts(fields[4]);

  let fullAddress = rawAddress;
  if (!fullAddress.toUpperCase().startsWith(street.toUpperCase())) {
    fullAddress = `${street} ${rawAddress}`.trim();
  }
  fullAddress = fixRepeatedAddress(fullAddress);

  return {
    address: fullAddress,
    name,
    products
  };
}

function parseNewFormatRow(fields) {
  if (fields.length < 6) return null;
  const street = fields[0].trim();
  const number = fields[1].trim();
  const stairwell = (fields[2] || '').trim();
  const apartment = (fields[3] || '').trim();
  const name = cleanAngleBrackets((fields[4] || '').trim());
  const products = extractProducts(fields[5] || '');

  if (!street || !number) return null;

  let address = `${street} ${number}`;
  if (stairwell) address += ` ${stairwell}`;
  if (apartment) address += ` ${apartment}`;
  address = fixRepeatedAddress(address);

  return {
    address,
    name,
    products
  };
}

function dedupeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = splitCsvRows(content);
  if (rows.length <= 1) {
    return { changed: false, collapsed: 0 };
  }

  const headerLine = rows[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const headerFields = tokenizeCsvFields(headerLine, delimiter).map(f => f.trim());
  const headerLower = headerFields.map(f => f.toLowerCase());
  const nameIndex = headerLower.findIndex(f => f.includes('nimi') || f.includes('tilaaja'));
  const productsIndex = headerLower.findIndex(f => f.startsWith('merk') || f.includes('tilaukset'));
  const format = detectFormat(headerFields);

  const map = new Map();
  const order = [];
  let collapsed = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.trim()) continue;
    const fields = tokenizeCsvFields(row, delimiter).map(f => f.trim());

    let parsed;
    if (format === 'new') parsed = parseNewFormatRow(fields);
    else parsed = parseLegacyRow(fields);

    if (!parsed || !parsed.address) {
      const fallbackKey = `__RAW__${i}`;
      if (!map.has(fallbackKey)) {
        map.set(fallbackKey, {
          fields,
          names: [(fields[nameIndex] || '').trim()].filter(Boolean),
          products: extractProducts(fields[productsIndex] || ''),
          orderIndex: i,
          originalLine: row,
          merged: false
        });
        order.push(fallbackKey);
      } else {
        const existing = map.get(fallbackKey);
        collapsed++;
        appendDistinctName(existing.names, fields[nameIndex] || '');
        mergeProductLists(existing.products, extractProducts(fields[productsIndex] || ''));
        existing.orderIndex = Math.min(existing.orderIndex, i);
        existing.merged = true;
      }
      continue;
    }

    const key = normalizeAddressForKey(parsed.address) || `__RAW_ADDR__${i}`;
    if (!map.has(key)) {
      map.set(key, {
        fields,
        names: nameIndex >= 0 && fields[nameIndex] ? [fields[nameIndex]] : (parsed.name ? [parsed.name] : []),
        products: [...parsed.products],
        orderIndex: i,
        originalLine: row,
        merged: false
      });
      order.push(key);
    } else {
      const existing = map.get(key);
      collapsed++;
      appendDistinctName(existing.names, nameIndex >= 0 ? fields[nameIndex] : parsed.name);
      mergeProductLists(existing.products, parsed.products);
      existing.orderIndex = Math.min(existing.orderIndex, i);
      existing.merged = true;
    }
  }

  if (!collapsed) {
    return { changed: false, collapsed: 0 };
  }

  const dedupedEntries = order
    .map(key => map.get(key))
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const bodyLines = dedupedEntries.map(entry => {
    if (!entry.merged) {
      return entry.originalLine;
    }
    const updated = entry.fields.slice();
    if (nameIndex >= 0 && updated.length > nameIndex) {
      const joinedNames = entry.names.length ? entry.names.join(' / ') : updated[nameIndex];
      updated[nameIndex] = joinedNames;
    }
    if (productsIndex >= 0 && updated.length > productsIndex) {
      const joinedProducts = entry.products.length ? entry.products.join(', ') : updated[productsIndex];
      updated[productsIndex] = joinedProducts;
    }
    return serializeFields(updated, delimiter);
  });

  const output = [headerLine, ...bodyLines].join('\n') + '\n';
  fs.writeFileSync(filePath, output, 'utf8');

  return { changed: true, collapsed };
}

function main() {
  const entries = fs.readdirSync(ROOT);
  const csvFiles = entries.filter(isCsvFile).map(file => path.join(ROOT, file));
  let totalCollapsed = 0;
  const touched = [];

  csvFiles.forEach(filePath => {
    try {
      const { changed, collapsed } = dedupeFile(filePath);
      if (changed) {
        touched.push({ file: path.basename(filePath), collapsed });
        totalCollapsed += collapsed;
      }
    } catch (error) {
      console.error(`[dedupe] Failed for ${path.basename(filePath)}:`, error.message);
    }
  });

  if (!touched.length) {
    console.log('No duplicate rows detected. All CSVs unchanged.');
    return;
  }

  console.log('Deduplicated CSV files:');
  touched.forEach(info => {
    console.log(`  ${info.file}: collapsed ${info.collapsed}`);
  });
  console.log(`Total collapsed rows: ${totalCollapsed}`);
}

main();
