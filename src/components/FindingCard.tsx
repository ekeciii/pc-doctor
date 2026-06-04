import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Info,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@/lib/types";
import { metricLabelFromCode, resolveFinding, useI18n, useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";

interface SeverityMeta {
  iconWrap: string;
  icon: JSX.Element;
  accent: string;
  border: string;
  /** durum LED'i + parlama rengi (CSS var) */
  glow: string;
  badge:
    | "destructive-soft"
    | "warning-soft"
    | "info-soft"
    | "success-soft";
}

const meta: Record<Severity, SeverityMeta> = {
  critical: {
    iconWrap: "bg-destructive-soft text-destructive",
    icon: <AlertOctagon className="w-5 h-5" />,
    accent: "before:bg-destructive",
    border: "border-destructive/35",
    glow: "var(--color-destructive)",
    badge: "destructive-soft",
  },
  warning: {
    iconWrap: "bg-warning-soft text-warning-strong",
    icon: <AlertTriangle className="w-5 h-5" />,
    accent: "before:bg-warning",
    border: "border-warning/35",
    glow: "var(--color-warning)",
    badge: "warning-soft",
  },
  info: {
    iconWrap: "bg-info-soft text-info",
    icon: <Info className="w-5 h-5" />,
    accent: "before:bg-info",
    border: "border-info/30",
    glow: "var(--color-info)",
    badge: "info-soft",
  },
  good: {
    iconWrap: "bg-success-soft text-success",
    icon: <CheckCircle2 className="w-5 h-5" />,
    accent: "before:bg-success",
    border: "border-success/30",
    glow: "var(--color-success)",
    badge: "success-soft",
  },
};

interface Props {
  finding: Finding;
  onSystemFileCheck?: (finding: Finding) => void;
  onDefenderQuickScan?: (finding: Finding) => void;
  onChkdskScan?: (finding: Finding, volume: string) => void;
  onChkdskFix?: (finding: Finding, volume: string, isSystem: boolean) => void;
  /** Guided (Rehberli) bulgular için "Nasıl?" → GuidedFixDrawer açar. */
  onGuided?: (finding: Finding) => void;
  /** Faz 2 — tek tık otomatik sistem fix'i (firewall/UAC/pagefile) → onay + run_fix_all. */
  onApplyFix?: (finding: Finding) => void;
  index?: number;
}

const TIER_CHIP: Record<"auto" | "guided" | "advisory", { key: TKey; cls: string }> = {
  auto: { key: "tierAuto", cls: "bg-success-soft text-success-strong" },
  guided: { key: "tierGuided", cls: "bg-info-soft text-info-strong" },
  advisory: { key: "tierAdvisory", cls: "bg-muted text-muted-foreground" },
};

export function FindingCard({
  finding,
  onSystemFileCheck,
  onDefenderQuickScan,
  onChkdskScan,
  onChkdskFix,
  onGuided,
  onApplyFix,
  index = 0,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const resolved = resolveFinding(finding, locale);
  const s = meta[finding.severity];
  const action = finding.action;
  const tier = finding.fixTier ?? "advisory";
  const tierChip = TIER_CHIP[tier];
  return (
    <Card
      variant="default"
      className={cn(
        "relative overflow-hidden animate-rise-in bg-card/60 backdrop-blur-sm",
        s.border,
        "transition-[box-shadow,transform] duration-300 hover:shadow-lg hover:-translate-y-0.5",
        "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        s.accent
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex gap-4 p-5 pl-6">
        <div
          className={cn("shrink-0 w-10 h-10 rounded-md flex items-center justify-center", s.iconWrap)}
          style={{ boxShadow: `0 0 14px -4px ${s.glow}` }}
        >
          {s.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <h3 className="font-display font-semibold text-base leading-tight text-foreground">
              {resolved.title}
            </h3>
            <Badge variant="outline" size="sm">
              {finding.category}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider",
                tierChip.cls
              )}
            >
              {t(tierChip.key)}
            </span>
            {/* Sprint 12 K-ext pilot — metricCode varsa locale-aware label, yoksa metric String fallback */}
            {(finding.metricCode || finding.metric) && (
              <Badge variant={s.badge} size="default">
                {finding.metricCode
                  ? metricLabelFromCode(finding.metricCode, locale)
                  : finding.metric}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {resolved.description}
          </p>
          {resolved.recommendedAction && (
            <p className="text-sm mt-2.5 italic border-l-2 border-primary/50 pl-3 text-foreground/85">
              {resolved.recommendedAction}
            </p>
          )}
        </div>
        {action && (
          <div className="shrink-0 flex items-start">
            {action.type === "runSystemFileCheck" && (
              <Button size="sm" onClick={() => onSystemFileCheck?.(finding)}>
                <Wrench className="w-4 h-4" />
                {t("fix")}
              </Button>
            )}
            {action.type === "runDefenderQuickScan" && (
              <Button size="sm" onClick={() => onDefenderQuickScan?.(finding)}>
                <ShieldCheck className="w-4 h-4" />
                {t("defenderQuickScan")}
              </Button>
            )}
            {action.type === "runChkdskScan" && (
              <Button size="sm" onClick={() => onChkdskScan?.(finding, action.volume)}>
                <Wrench className="w-4 h-4" />
                {resolved.actionLabel ?? t("fix")}
              </Button>
            )}
            {action.type === "runChkdskFix" && (
              <Button
                size="sm"
                variant="warning"
                onClick={() => onChkdskFix?.(finding, action.volume, action.isSystem)}
              >
                <Wrench className="w-4 h-4" />
                {resolved.actionLabel ?? t("fix")}
              </Button>
            )}
            {(action.type === "openSystemPropertiesPerformance" ||
              action.type === "openUrl") && (
              <Button size="sm" variant="outline" onClick={() => onGuided?.(finding)}>
                <Compass className="w-4 h-4" />
                {t("guidedCta")}
              </Button>
            )}
            {(action.type === "enableFirewall" ||
              action.type === "enableUac" ||
              action.type === "setPagefileManaged") && (
              <Button size="sm" onClick={() => onApplyFix?.(finding)}>
                <Wrench className="w-4 h-4" />
                {resolved.actionLabel ?? t("fix")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
