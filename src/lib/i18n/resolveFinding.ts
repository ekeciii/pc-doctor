// Sprint 6 — Finding code resolver with `{param}` interpolation + tiered fallback.

import { findingsTr, type FindingCode } from "./findings.tr";
import { findingsEn } from "./findings.en";
import type { Locale } from "./context";
import type { Finding } from "../types";

const DICTS: Record<Locale, Record<FindingCode, string>> = {
  tr: findingsTr,
  en: findingsEn,
};

function interpolate(template: string, params?: Record<string, string | number> | null): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const v = params[key];
      return v === undefined || v === null ? match : String(v);
    }
    return match;
  });
}

export interface ResolvedFinding {
  title: string;
  description: string;
  recommendedAction: string | null;
  actionLabel: string | null;
}

/**
 * 3-tier fallback for missing code:
 *  1. dict[code] (locale)
 *  2. TR dict (cross-locale safety: EN tab boş yerine TR cümle daha az kötü)
 *  3. legacy finding.title/description (Sprint <6)
 *  4. boş string (DEV ortamda console.warn — kullanıcıya raw code GÖSTERME)
 */
function lookup(
  dict: Record<FindingCode, string>,
  code: string | undefined,
  legacy: string,
  params: Record<string, string | number> | null
): string {
  if (!code) return legacy || "";
  const direct = (dict as Record<string, string | undefined>)[code];
  if (direct) return interpolate(direct, params);
  const trFallback = (findingsTr as Record<string, string | undefined>)[code];
  if (trFallback) return interpolate(trFallback, params);
  if (legacy) return legacy;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] Missing finding code: ${code}`);
  }
  return "";
}

export function resolveFinding(finding: Finding, locale: Locale): ResolvedFinding {
  const dict = DICTS[locale] ?? DICTS.tr;
  const params = (finding.params ?? null) as Record<string, string | number> | null;

  const title = lookup(dict, finding.titleCode, finding.title || "", params);
  const description = lookup(dict, finding.descriptionCode, finding.description || "", params);
  const actionLabel = finding.actionCode
    ? lookup(dict, finding.actionCode, "", params) || null
    : null;
  // Faz 3 — recommendationCode varsa locale'e göre çözülür; yoksa (eski/sentetik Finding)
  // legacy recommendedAction TR string'ine düşer.
  const recommendedAction = finding.recommendationCode
    ? lookup(dict, finding.recommendationCode, finding.recommendedAction || "", params) || null
    : (finding.recommendedAction ?? null);

  return {
    title,
    description,
    recommendedAction,
    actionLabel: actionLabel && actionLabel.length > 0 ? actionLabel : null,
  };
}
