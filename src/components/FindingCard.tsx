import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
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

interface SeverityMeta {
  iconWrap: string;
  icon: JSX.Element;
  accent: string;
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
    badge: "destructive-soft",
  },
  warning: {
    iconWrap: "bg-warning-soft text-warning-strong",
    icon: <AlertTriangle className="w-5 h-5" />,
    accent: "before:bg-warning",
    badge: "warning-soft",
  },
  info: {
    iconWrap: "bg-info-soft text-info",
    icon: <Info className="w-5 h-5" />,
    accent: "before:bg-info",
    badge: "info-soft",
  },
  good: {
    iconWrap: "bg-success-soft text-success",
    icon: <CheckCircle2 className="w-5 h-5" />,
    accent: "before:bg-success",
    badge: "success-soft",
  },
};

interface Props {
  finding: Finding;
  onSystemFileCheck?: (finding: Finding) => void;
  onDefenderQuickScan?: (finding: Finding) => void;
  onChkdskScan?: (finding: Finding, volume: string) => void;
  onChkdskFix?: (finding: Finding, volume: string, isSystem: boolean) => void;
  onOpenSystemPropertiesPerformance?: () => void;
  onOpenUrl?: (url: string) => void;
  index?: number;
}

export function FindingCard({
  finding,
  onSystemFileCheck,
  onDefenderQuickScan,
  onChkdskScan,
  onChkdskFix,
  onOpenSystemPropertiesPerformance,
  onOpenUrl,
  index = 0,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const resolved = resolveFinding(finding, locale);
  const s = meta[finding.severity];
  const action = finding.action;
  return (
    <Card
      variant="default"
      className={cn(
        "relative overflow-hidden animate-rise-in",
        "transition-[box-shadow,transform] duration-300 hover:shadow-md hover:-translate-y-0.5",
        "before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-1",
        s.accent
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex gap-4 p-5 pl-6">
        <div className={cn("shrink-0 w-10 h-10 rounded-md flex items-center justify-center", s.iconWrap)}>
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
            {action.type === "openSystemPropertiesPerformance" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenSystemPropertiesPerformance?.()}
              >
                <ExternalLink className="w-4 h-4" />
                {resolved.actionLabel ?? t("goToOem")}
              </Button>
            )}
            {action.type === "openUrl" && (
              <Button size="sm" variant="outline" onClick={() => onOpenUrl?.(action.url)}>
                <ExternalLink className="w-4 h-4" />
                {t("goToOem")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
