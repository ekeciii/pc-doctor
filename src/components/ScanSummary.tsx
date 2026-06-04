import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Download,
  FileSearch,
  HardDrive,
  ListChecks,
  Lock,
  Power,
  ScrollText,
  ShieldCheck,
  Thermometer,
  Wrench,
} from "lucide-react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import type { Finding, ScanReport, Severity } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

interface CategoryDef {
  key: string;
  label: string;
  icon: JSX.Element;
  /** Hangi Finding.category değerleri buraya düşer */
  matches: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "disk-full",
    label: "Disk doluluk",
    icon: <HardDrive className="w-4 h-4" />,
    matches: ["Disk"],
  },
  {
    key: "disk-health",
    label: "Disk sağlığı (SMART)",
    icon: <Activity className="w-4 h-4" />,
    matches: ["Disk sağlığı"],
  },
  {
    key: "events",
    label: "Olay günlüğü",
    icon: <ScrollText className="w-4 h-4" />,
    matches: ["Olay günlüğü"],
  },
  {
    key: "drivers",
    label: "Sürücüler",
    icon: <Cpu className="w-4 h-4" />,
    matches: ["Sürücü"],
  },
  {
    key: "virus",
    label: "Virüs/Defender",
    icon: <ShieldCheck className="w-4 h-4" />,
    matches: ["Virüs"],
  },
  {
    key: "thermal",
    label: "Sıcaklık / throttling",
    icon: <Thermometer className="w-4 h-4" />,
    matches: ["Donanım"],
  },
  {
    key: "security",
    label: "Güvenlik konfigi",
    icon: <Lock className="w-4 h-4" />,
    matches: ["Güvenlik"],
  },
  {
    key: "updates",
    label: "Bekleyen güncellemeler",
    icon: <Download className="w-4 h-4" />,
    matches: ["Güncelleme"],
  },
  {
    key: "startup",
    label: "Başlangıç performansı",
    icon: <Power className="w-4 h-4" />,
    matches: ["Başlangıç"],
  },
  {
    key: "crashes",
    label: "Çökme geçmişi",
    icon: <AlertTriangle className="w-4 h-4" />,
    matches: ["Çökme geçmişi"],
  },
  {
    key: "pagefile",
    label: "Sanal bellek",
    icon: <Database className="w-4 h-4" />,
    matches: ["Sanal bellek"],
  },
  {
    key: "chkdsk",
    label: "Disk bütünlüğü",
    icon: <FileSearch className="w-4 h-4" />,
    matches: ["Disk bütünlüğü"],
  },
  {
    key: "cleanup",
    label: "Temizlik fırsatları",
    icon: <Wrench className="w-4 h-4" />,
    matches: [], // özel hesap
  },
];

interface Props {
  report: ScanReport;
}

export function ScanSummary({ report }: Props) {
  const totalFindings = report.findings.length;
  const critical = report.findings.filter((f) => f.severity === "critical").length;
  const warning = report.findings.filter((f) => f.severity === "warning").length;
  const reclaimableMB = report.totalReclaimableBytes / (1024 * 1024);

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border">
        <Metric
          label="Toplam tanı"
          value={String(totalFindings)}
          tone={critical ? "destructive" : warning ? "warning" : "success"}
          hint={
            critical > 0
              ? `${critical} kritik`
              : warning > 0
                ? `${warning} uyarı`
                : "Tümü sağlıklı"
          }
        />
        <Metric
          label="Kontrol edilen"
          value={String(CATEGORIES.length)}
          tone="primary"
          hint="kategori"
        />
        <Metric
          label="Temizlik fırsatı"
          value={formatBytes(report.totalReclaimableBytes)}
          tone={reclaimableMB > 500 ? "warning" : "muted"}
          hint={`${report.cleanupTargets.length} hedef`}
        />
      </div>

      <div className="p-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" />
          Kapsam
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => {
            const stats = computeStats(cat, report);
            return (
              <CategoryRow
                key={cat.key}
                icon={cat.icon}
                label={cat.label}
                status={stats.status}
                detail={stats.detail}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "destructive" | "warning" | "success" | "muted";
}) {
  const toneClass = {
    primary: "text-primary-strong",
    destructive: "text-destructive-strong",
    warning: "text-warning-strong",
    success: "text-success-strong",
    muted: "text-foreground",
  }[tone];
  return (
    <div className="bg-card p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
        {label}
      </div>
      <div className={cn("font-display text-3xl font-extrabold tracking-tight tabular-nums", toneClass)}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

function CategoryRow({
  icon,
  label,
  status,
  detail,
}: {
  icon: JSX.Element;
  label: string;
  status: "ok" | "info" | "warning" | "critical" | "skipped";
  detail: string;
}) {
  const statusBadge = {
    ok: { variant: "success-soft" as const, text: "OK" },
    info: { variant: "info-soft" as const, text: "Bilgi" },
    warning: { variant: "warning-soft" as const, text: "Uyarı" },
    critical: { variant: "destructive-soft" as const, text: "Kritik" },
    skipped: { variant: "outline" as const, text: "—" },
  }[status];
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/40 border border-border/60">
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
          status === "ok"
            ? "bg-success-soft text-success-strong"
            : status === "critical"
              ? "bg-destructive-soft text-destructive-strong"
              : status === "warning"
                ? "bg-warning-soft text-warning-strong"
                : status === "info"
                  ? "bg-info-soft text-info-strong"
                  : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{detail}</div>
      </div>
      <Badge variant={statusBadge.variant} size="sm">
        {statusBadge.text}
      </Badge>
    </div>
  );
}

interface CategoryStats {
  status: "ok" | "info" | "warning" | "critical" | "skipped";
  detail: string;
}

function computeStats(cat: CategoryDef, report: ScanReport): CategoryStats {
  if (cat.key === "cleanup") {
    if (report.cleanupTargets.length === 0) {
      return { status: "ok", detail: "Temiz" };
    }
    return {
      status: "info",
      detail: `${report.cleanupTargets.length} hedef · ${formatBytes(report.totalReclaimableBytes)}`,
    };
  }
  const related = report.findings.filter((f: Finding) => cat.matches.includes(f.category));
  if (related.length === 0) {
    return { status: "ok", detail: "Sorun yok" };
  }
  const worst = related
    .map((f) => f.severity)
    .sort((a, b) => severityRank(a) - severityRank(b))[0];
  const counts = {
    critical: related.filter((f) => f.severity === "critical").length,
    warning: related.filter((f) => f.severity === "warning").length,
    info: related.filter((f) => f.severity === "info").length,
  };
  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} kritik`);
  if (counts.warning) parts.push(`${counts.warning} uyarı`);
  if (counts.info) parts.push(`${counts.info} bilgi`);
  return {
    status: worst === "good" ? "ok" : (worst as "critical" | "warning" | "info"),
    detail: parts.join(" · "),
  };
}

function severityRank(s: Severity): number {
  return { critical: 0, warning: 1, info: 2, good: 3 }[s];
}
