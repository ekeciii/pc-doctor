import type { Finding } from "./types";

/** Bir bulgu kümesinin kararlı (sıra-bağımsız) imzası — aynı bulgular aynı
 * imzayı üretir, id'lerden biri değişirse/eklenirse/çıkarsa imza değişir. */
export function computeFindingSignature(findings: Finding[]): string {
  return findings
    .map((f) => f.id)
    .sort()
    .join("|");
}

/** Bu kategori için maskot kendiliğinden belirmeli mi? Yalnız imza daha önce
 * görülmemişse (veya değiştiyse) true. */
export function shouldShowMascot(
  categoryKey: string,
  signature: string,
  seenSignatures: Record<string, string>
): boolean {
  if (!signature) return false;
  return seenSignatures[categoryKey] !== signature;
}
