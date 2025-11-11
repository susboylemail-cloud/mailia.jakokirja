import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import path from 'path';
import fs from 'fs';

const router = Router();

const ROOT_DIR = path.resolve(process.cwd(), '..', '..'); // project root
const WL_PATH = path.join(ROOT_DIR, 'duplicates-whitelist.json');

function loadWhitelist(){
  try {
    if (fs.existsSync(WL_PATH)) {
      return JSON.parse(fs.readFileSync(WL_PATH, 'utf8'));
    }
  } catch {}
  return { buildings: [], units: [] };
}

function saveWhitelist(obj: any){
  fs.writeFileSync(WL_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

router.get('/duplicates', authenticate, authorize('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  try {
    const buildings = await query(
      `SELECT LOWER(s.building_address) AS key,
              ARRAY_AGG(DISTINCT c.circuit_id) AS circuits,
              COUNT(*) AS total,
              MIN(s.address) AS example
         FROM subscribers s
         JOIN circuits c ON s.circuit_id = c.id
        GROUP BY LOWER(s.building_address)
       HAVING COUNT(DISTINCT c.circuit_id) > 1
       ORDER BY COUNT(*) DESC, MIN(s.address) ASC
       LIMIT 500`
    );

    const units = await query(
      `SELECT LOWER(s.building_address) || '|' || LOWER(COALESCE(s.stairwell,'')) || '|' || LOWER(COALESCE(s.apartment,'')) AS key,
              ARRAY_AGG(DISTINCT c.circuit_id) AS circuits,
              COUNT(*) AS total,
              MIN(s.address) AS example
         FROM subscribers s
         JOIN circuits c ON s.circuit_id = c.id
        GROUP BY LOWER(s.building_address), LOWER(COALESCE(s.stairwell,'')), LOWER(COALESCE(s.apartment,''))
       HAVING COUNT(DISTINCT c.circuit_id) > 1
       ORDER BY COUNT(*) DESC, MIN(s.address) ASC
       LIMIT 500`
    );

    const whitelist = loadWhitelist();

    res.json({
      generatedAt: new Date().toISOString(),
      overlaps: {
        buildings: buildings.rows,
        units: units.rows
      },
      whitelist
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to compute overlaps', details: e?.message });
  }
});

router.get('/whitelist', authenticate, authorize('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const whitelist = loadWhitelist();
  res.json(whitelist);
});

router.put('/whitelist', authenticate, authorize('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const mode = (req.body?.mode || 'merge').toLowerCase();
  const payload = req.body || {};
  const current = loadWhitelist();

  if (mode === 'replace') {
    saveWhitelist({
      buildings: Array.isArray(payload.buildings) ? payload.buildings : [],
      units: Array.isArray(payload.units) ? payload.units : []
    });
    return res.json({ status: 'ok', mode: 'replace' });
  }

  const mergeList = (existing: any[], add: any[]) => {
    const map = new Map<string, any>();
    for (const e of existing || []) {
      const key = typeof e === 'string' ? e.toLowerCase() : String(e?.key || '').toLowerCase();
      if (!key) continue; map.set(key, e);
    }
    for (const e of add || []) {
      const key = typeof e === 'string' ? e.toLowerCase() : String(e?.key || '').toLowerCase();
      if (!key) continue; map.set(key, e);
    }
    return Array.from(map.values());
  };

  const next = {
    buildings: mergeList(current.buildings, Array.isArray(payload.buildings) ? payload.buildings : []),
    units: mergeList(current.units, Array.isArray(payload.units) ? payload.units : [])
  };
  saveWhitelist(next);
  res.json({ status: 'ok', mode: 'merge', counts: { buildings: next.buildings.length, units: next.units.length } });
});

export default router;
