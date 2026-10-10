// Compares dotted versions numerically ("0.10.0" is newer than "0.9.0"). Missing parts count as 0,
// so "1.2" equals "1.2.0". Returns -1 if a is older than b, 1 if newer, 0 if equal.
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
