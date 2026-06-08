import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Download,
  FileSearch,
  HardDrive,
  Lock,
  Power,
  ScrollText,
  ShieldCheck,
  Thermometer,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import type { ScanReport, Severity } from "@/lib/types";

export interface CategoryDef {
  key: string;
  /** TR display label (i18n borcu — ScanSummary ile tutarlı). */
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Hangi `Finding.category` değerleri buraya düşer. */
  matches: string[];
}

/** 13 tanı kategorisi + temizlik. Backend `Finding.category` (TR) string'leriyle eşleşir. */
export const CATEGORIES: CategoryDef[] = [
  { key: "disk-full", label: "Disk doluluk", icon: HardDrive, matches: ["Disk"] },
  { key: "disk-health", label: "Disk sağlığı", icon: Activity, matches: ["Disk sağlığı"] },
  { key: "chkdsk", label: "Disk bütünlüğü", icon: FileSearch, matches: ["Disk bütünlüğü"] },
  { key: "events", label: "Olay günlüğü", icon: ScrollText, matches: ["Olay günlüğü"] },
  { key: "drivers", label: "Sürücüler", icon: Cpu, matches: ["Sürücü"] },
  { key: "virus", label: "Virüs/Defender", icon: ShieldCheck, matches: ["Virüs"] },
  { key: "thermal", label: "Sıcaklık", icon: Thermometer, matches: ["Donanım"] },
  { key: "security", label: "Güvenlik konfigi", icon: Lock, matches: ["Güvenlik"] },
  { key: "updates", label: "Güncellemeler", icon: Download, matches: ["Güncelleme"] },
  { key: "startup", label: "Başlangıç", icon: Power, matches: ["Başlangıç"] },
  { key: "crashes", label: "Çökme geçmişi", icon: AlertTriangle, matches: ["Çökme geçmişi"] },
  { key: "pagefile", label: "Sanal bellek", icon: Database, matches: ["Sanal bellek"] },
  { key: "cleanup", label: "Temizlik", icon: Wrench, matches: ["Temizlik"] },
];

export type CategoryStatus = "ok" | "info" | "warning" | "critical";

export interface CategoryStat {
  status: CategoryStatus;
  count: number;
}

function rank(s: Severity): number {
  return { critical: 0, warning: 1, info: 2, good: 3 }[s];
}

/** Bir kategorinin en kötü bulgusuna göre durumu + bulgu sayısı. */
export function categoryStat(cat: CategoryDef, report: ScanReport): CategoryStat {
  const related = report.findings.filter((f) => cat.matches.includes(f.category));
  if (related.length === 0) return { status: "ok", count: 0 };
  const worst = related.map((f) => f.severity).sort((a, b) => rank(a) - rank(b))[0];
  return {
    status: worst === "good" ? "ok" : (worst as CategoryStatus),
    count: related.length,
  };
}
