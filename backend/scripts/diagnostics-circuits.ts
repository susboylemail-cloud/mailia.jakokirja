/**
 * Diagnostics: scan all circuits for duplicates and cross-circuit overlaps
 *
 * Outputs a summary table and saves a JSON report in backend/logs/
 * Usage:
 *   - Local:  npm run diagnostics:circuits
 *   - Heroku: heroku run "cd backend && npx tsx scripts/diagnostics-circuits.ts" -a <app>
 */

import { query } from '../src/config/database';
import fs from 'fs';
import path from 'path';

interface CircuitSummary {
  circuitId: string;
  total: number;
  distinctAddresses: number;
  dupGroups: number; // number of addresses with COUNT(*) > 1
  dupRows: number;   // total - distinctAddresses
  dupRatio: number;  // dupRows / total
  overlaps: number;  // cross-circuit unit-level overlaps
}

async function getPerCircuitStats(): Promise<CircuitSummary[]> {
  // Totals, distincts, and duplicate groups per circuit
  const statsSql = `
    WITH per_addr AS (
      SELECT c.circuit_id,
             s.address,
             COUNT(*) AS cnt
      FROM subscribers s
      JOIN circuits c ON s.circuit_id = c.id
      GROUP BY c.circuit_id, s.address
    )
    SELECT circuit_id,
           SUM(cnt) AS total,
           COUNT(*) AS distinct_addresses,
           COUNT(*) FILTER (WHERE cnt > 1) AS dup_groups
    FROM per_addr
    GROUP BY circuit_id
    ORDER BY circuit_id;
  `;

  const res = await query(statsSql);
  const map = new Map<string, CircuitSummary>();
  for (const row of res.rows) {
    const total = Number(row.total);
    const distinct = Number(row.distinct_addresses);
    const dupRows = total - distinct;
    map.set(row.circuit_id, {
      circuitId: row.circuit_id,
      total,
      distinctAddresses: distinct,
      dupGroups: Number(row.dup_groups),
      dupRows,
      dupRatio: total > 0 ? dupRows / total : 0,
      overlaps: 0,
    });
  }

  // Cross-circuit overlaps: same (building_address, stairwell, apartment) appearing in >1 circuits
  const overlapSql = `
    WITH base AS (
      SELECT LOWER(TRIM(REGEXP_REPLACE(s.building_address, '\\s+', ' ', 'g'))) AS b,
             COALESCE(LOWER(TRIM(s.stairwell)), '') AS st,
             COALESCE(LOWER(TRIM(s.apartment)), '') AS ap,
             s.circuit_id AS cid
      FROM subscribers s
    ), groups AS (
      SELECT b, st, ap, COUNT(DISTINCT cid) AS circuit_count
      FROM base
      GROUP BY 1,2,3
      HAVING COUNT(DISTINCT cid) > 1
    )
    SELECT c.circuit_id, COUNT(*) AS overlaps
    FROM base
    JOIN groups g USING (b, st, ap)
    JOIN circuits c ON c.id = base.cid
    GROUP BY c.circuit_id;
  `;

  const overlapsRes = await query(overlapSql);
  for (const row of overlapsRes.rows) {
    const existing = map.get(row.circuit_id);
    if (existing) existing.overlaps = Number(row.overlaps);
    else {
      map.set(row.circuit_id, {
        circuitId: row.circuit_id,
        total: 0,
        distinctAddresses: 0,
        dupGroups: 0,
        dupRows: 0,
        dupRatio: 0,
        overlaps: Number(row.overlaps),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.circuitId.localeCompare(b.circuitId));
}

async function getTopDuplicates(limit = 10) {
  const sql = `
    SELECT c.circuit_id, s.address, COUNT(*) AS cnt
    FROM subscribers s
    JOIN circuits c ON s.circuit_id = c.id
    GROUP BY c.circuit_id, s.address
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, c.circuit_id
    LIMIT $1
  `;
  const res = await query(sql, [limit]);
  return res.rows;
}

async function main() {
  console.log('\n=== Diagnostics: Circuits duplicates and overlaps ===');
  const summaries = await getPerCircuitStats();

  // Console summary table
  const table = summaries.map(s => ({
    circuit: s.circuitId,
    total: s.total,
    distinct: s.distinctAddresses,
    dupGroups: s.dupGroups,
    dupRows: s.dupRows,
    dupRatio: Number(s.dupRatio.toFixed(3)),
    overlaps: s.overlaps,
  }));
  console.table(table);

  // Top offenders by dupRatio and overlaps
  const topDupRatio = [...summaries]
    .filter(s => s.total > 0)
    .sort((a, b) => b.dupRatio - a.dupRatio)
    .slice(0, 10);

  const topOverlaps = [...summaries]
    .sort((a, b) => b.overlaps - a.overlaps)
    .slice(0, 10);

  console.log('\nTop 10 by duplicate ratio:');
  console.table(topDupRatio.map(s => ({ circuit: s.circuitId, total: s.total, dupRows: s.dupRows, dupRatio: Number(s.dupRatio.toFixed(3)) })));

  console.log('\nTop 10 by cross-circuit overlaps:');
  console.table(topOverlaps.map(s => ({ circuit: s.circuitId, overlaps: s.overlaps })));

  // Top duplicate addresses overall
  const topDupAddrs = await getTopDuplicates(15);
  if (topDupAddrs.length) {
    console.log('\nTop duplicate addresses:');
    console.table(topDupAddrs);
  }

  // Persist JSON report
  const report = {
    generatedAt: new Date().toISOString(),
    summaries,
    topDupRatio,
    topOverlaps,
    topDuplicateAddresses: topDupAddrs,
  };
  const logsDir = path.resolve(__dirname, '../logs');
  try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}
  const file = path.join(logsDir, `diagnostics-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nSaved report: ${file}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Diagnostics failed:', err);
    process.exit(1);
  });
