// Utility functions to normalize building and unit keys similar to frontend & duplicate scanner

export const collapse = (s: string | undefined | null): string => (s || '').toLowerCase().normalize('NFC').replace(/\s+/g,' ').trim();
export const compact = (s: string | undefined | null): string => collapse(s).replace(/\s+/g,'');

// For legacy rows address contains street + number (+ optional letter). We already get building_address separately.
export function buildingKey(buildingAddress: string): string {
  return collapse(buildingAddress);
}

export function unitKey(buildingAddress: string, stairwell?: string | null, apartment?: string | null): string {
  const b = buildingKey(buildingAddress);
  const porras = compact(stairwell || '');
  const apt = compact((apartment || '').replace(/^as\.?\s*/i,''));
  return `${b}|${porras}|${apt}`;
}

// Heuristic classification helpers
export function classifyBuildingVariant(buildingAddress: string): string[] {
  const variants: string[] = [];
  const m = buildingAddress.match(/^(.*?)(\s+(\d+)([A-Za-z]))$/); // street + number + letter
  if (m) {
    variants.push('letter-suffix');
  }
  if (/\s+\d+\s*[A-Za-z]{1,2}$/.test(buildingAddress)) {
    variants.push('alpha-suffix');
  }
  return variants;
}

export function similarCircuitBase(circuits: string[]): string | null {
  // If all circuits share the same numeric part
  const nums = circuits.map(c => c.replace(/[^0-9]/g,'')).filter(Boolean);
  if (!nums.length) return null;
  const allSame = nums.every(n => n === nums[0]);
  if (allSame) return nums[0];
  return null;
}

// Collapse accidental repeated address strings and duplicated street tokens
// Examples:
//  "SALAMAKUJA 5 SALAMAKUJA 5" -> "SALAMAKUJA 5"
//  "PILVIKUJA PILVIKUJA 5 B 6" -> "PILVIKUJA 5 B 6"
export function fixRepeatedAddress(address: string): string {
  if (!address) return address;
  const a = address.trim().replace(/\s+/g,' ');
  const parts = a.split(' ');
  if (parts.length >= 4 && parts.length % 2 === 0) {
    const half = parts.length/2;
    const first = parts.slice(0,half).join(' ');
    const second = parts.slice(half).join(' ');
    if (first.toUpperCase() === second.toUpperCase()) {
      return first;
    }
  }
  const m = a.match(/^([A-ZÅÄÖ]+)\s+\1\s+(.*)$/i);
  if (m) {
    return `${m[1]} ${m[2]}`.trim();
  }
  return a;
}
