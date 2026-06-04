// Sprint 9 K — locale-aware metric label.
// Sprint 12 K-ext pilot — `MetricCode` enum tercih edilir (locale-aware unit).
// Backend `metricCode` varsa onu kullan, yoksa eski String + code path fallback.

import type { Locale } from "./context";
import type { MetricCode } from "../types";

interface Params {
  [k: string]: string | number;
}

/**
 * Sprint 12 K-ext pilot — locale-aware metric label kodlu enum'dan.
 * Backend 3 detector (thermal/pagefile/disk_full) bu enum'u emit eder.
 */
export function metricLabelFromCode(mc: MetricCode, locale: Locale): string {
  switch (mc.type) {
    case "temperatureCelsius":
      return `${mc.value.toFixed(0)}°C`;
    case "percentage":
      return `${mc.value.toFixed(1)}%`;
    case "bytes": {
      const mb = mc.value / (1024 * 1024);
      const gb = mb / 1024;
      if (gb >= 1) return `${gb.toFixed(1)} GB`;
      if (mb >= 1) return `${mb.toFixed(0)} MB`;
      return `${mc.value} B`;
    }
    case "count":
      return locale === "tr" ? `${mc.value} adet` : `${mc.value}`;
    case "days":
      return locale === "tr" ? `${mc.value} gün` : `${mc.value} days`;
    case "bareString":
      return mc.text;
  }
}

const NUMERIC_RE = /^[0-9]+(?:\.[0-9]+)?$/;

/**
 * Backend'den gelen `metric` ham değerini kategori bağlamında locale-aware label'a çevir.
 * `code` Sprint 7 finding code ("finding.disk_full.full.title" vb.); kategori örtük türetilir.
 *
 * Çıktı her zaman string — ham metric değer DROP edilmez sadece zenginleştirilir.
 */
export function metricLabel(
  metric: string | null,
  code: string | null,
  _params: Params | null,
  locale: Locale
): string {
  if (!metric) return "";
  // Drivers outdated: "2.5y" → "2.5 yıl" / "2.5 years"
  if (code?.startsWith("finding.driver.outdated") && metric.endsWith("y")) {
    const num = metric.slice(0, -1);
    return locale === "tr" ? `${num} yıl` : `${num} years`;
  }
  // Driver unsigned/security/uac/bitlocker/firewall sabit "!"
  if (metric === "!") {
    return locale === "tr" ? "!" : "!";
  }
  // Defender age days: numerik → "X gün eski" / "X days old"
  if (code?.startsWith("finding.defender.sig_stale") && NUMERIC_RE.test(metric)) {
    return locale === "tr" ? `${metric} gün eski` : `${metric} days old`;
  }
  if (code?.startsWith("finding.defender.scan_stale") && NUMERIC_RE.test(metric)) {
    return locale === "tr" ? `${metric} gün önce` : `${metric} days ago`;
  }
  // Startup seconds suffix
  if (code?.startsWith("finding.startup.slow") && metric.endsWith("s")) {
    const num = metric.slice(0, -1);
    return locale === "tr" ? `${num} sn` : `${num}s`;
  }
  // Numeric count without unit (defender.active_threats, chkdsk.errors_detected, vb.)
  if (NUMERIC_RE.test(metric)) {
    if (code?.startsWith("finding.defender.active_threats")) {
      return locale === "tr" ? `${metric} tehdit` : `${metric} threats`;
    }
    if (code?.startsWith("finding.chkdsk.errors_detected")) {
      return locale === "tr" ? `${metric} hata` : `${metric} errors`;
    }
    if (code?.startsWith("finding.updates")) {
      return locale === "tr" ? `${metric} adet` : `${metric} pending`;
    }
    if (code?.startsWith("finding.crash.wer")) {
      return locale === "tr" ? `${metric} kayıt` : `${metric} records`;
    }
    if (code?.startsWith("finding.startup.too_many")) {
      return locale === "tr" ? `${metric} öğe` : `${metric} items`;
    }
    if (code?.startsWith("finding.security.dns_unknown")) {
      return locale === "tr" ? `${metric} bilinmeyen` : `${metric} unknown`;
    }
    if (code?.startsWith("finding.security.hosts_suspicious")) {
      return locale === "tr" ? `${metric} satır` : `${metric} lines`;
    }
  }
  // Default — Backend zaten "%5.0" veya "70°C" gibi locale-neutral
  return metric;
}
