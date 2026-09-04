import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  LockKeyhole,
  RotateCw,
  ShieldCheck,
  ShieldX,
  Wrench,
} from "lucide-react";
import type { SecurityConfig } from "@/lib/types";
import { openOemLink, securityOverview } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/useAsync";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

interface Props {
  /** Kapalı güvenlik duvarı profillerini aç (onay + restore point → run_fix_all). */
  onEnableFirewall: () => void;
  /** UAC'yi aç (reboot gerektirir → run_fix_all). */
  onEnableUac: () => void;
}

type Tone = "ok" | "warn" | "bad" | "muted";

/** Güvenlik konfigi kategorisi — firewall/UAC/BitLocker/DNS/hosts duruş panosu. */
export function SecurityPanel({ onEnableFirewall, onEnableUac }: Props) {
  const t = useT();
  const { data: cfg, loading, error, reload: load } = useAsync(securityOverview);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("securityHeading")}
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:text-primary-strong disabled:opacity-50"
        >
          <RotateCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {t("rescan")}
        </button>
      </div>

      {loading && !cfg && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("securityLoading")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {error}
        </div>
      )}

      {cfg && (
        <>
          {/* Firewall */}
          <PostureCard
            icon={<ShieldCheck className="w-4 h-4" />}
            title={t("securityFirewall")}
            tone={firewallTone(cfg)}
            value={firewallValue(cfg, t)}
            action={
              firewallTone(cfg) === "bad" ? (
                <Button size="sm" onClick={onEnableFirewall}>
                  <Wrench className="w-4 h-4" />
                  {t("securityEnableFirewall")}
                </Button>
              ) : undefined
            }
          />

          {/* UAC */}
          <PostureCard
            icon={<ShieldCheck className="w-4 h-4" />}
            title={t("securityUac")}
            tone={cfg.uacEnabled === false ? "bad" : cfg.uacConsentLevel === 0 ? "warn" : "ok"}
            value={
              cfg.uacEnabled === false
                ? t("securityUacOff")
                : cfg.uacConsentLevel === 0
                  ? t("securityUacNoPrompt")
                  : t("securityUacOn")
            }
            action={
              cfg.uacEnabled === false ? (
                <Button size="sm" onClick={onEnableUac}>
                  <Wrench className="w-4 h-4" />
                  {t("securityEnableUac")}
                </Button>
              ) : undefined
            }
          />

          {/* BitLocker (laptop) */}
          {cfg.isLaptop && (
            <PostureCard
              icon={<LockKeyhole className="w-4 h-4" />}
              title={t("securityBitlocker")}
              tone={
                cfg.bitlockerCProtected === false
                  ? "warn"
                  : cfg.bitlockerCProtected
                    ? "ok"
                    : "muted"
              }
              value={
                cfg.bitlockerCProtected == null
                  ? t("securityUnknown")
                  : cfg.bitlockerCProtected
                    ? t("securityBitlockerOn")
                    : t("securityBitlockerOff")
              }
              action={
                cfg.bitlockerCProtected === false ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openOemLink("ms-settings:deviceencryption").catch(() => {})}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t("securityOpenSettings")}
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* DNS */}
          {cfg.dnsServers.length > 0 && (
            <Card variant="default" className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("securityDns")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openOemLink("ms-settings:network-status").catch(() => {})}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("securityOpenSettings")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cfg.dnsServers.map((ip, i) => (
                  <span
                    key={`${ip}-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-muted text-foreground/90 tabular-nums"
                  >
                    {ip}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{t("securityDnsHint")}</p>
            </Card>
          )}

          {/* hosts */}
          <PostureCard
            icon={<Lock className="w-4 h-4" />}
            title={t("securityHosts")}
            tone={cfg.hostsSuspiciousLines.length > 0 ? "warn" : "ok"}
            value={
              cfg.hostsSuspiciousLines.length > 0
                ? t("securityHostsSuspicious", { count: cfg.hostsSuspiciousLines.length })
                : t("securityHostsClean", { count: cfg.hostsEntryCount })
            }
          />
          {cfg.hostsSuspiciousLines.length > 0 && (
            <details className="px-1">
              <summary className="cursor-pointer text-[11px] font-mono text-primary hover:text-primary-strong">
                {t("securityHostsShow")}
              </summary>
              <div className="mt-2 rounded-md bg-foreground/95 text-background/90 p-3 text-[11px] font-mono space-y-0.5 max-h-40 overflow-auto">
                {cfg.hostsSuspiciousLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{t("securityHostsHint")}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function firewallTone(cfg: SecurityConfig): Tone {
  if (cfg.firewallProfiles == null) return "bad";
  const disabled = cfg.firewallProfiles.filter((p) => !p.enabled);
  if (disabled.length === 0) return "ok";
  if (cfg.thirdPartyFirewall) return "muted";
  return "bad";
}

function firewallValue(cfg: SecurityConfig, t: ReturnType<typeof useT>): string {
  if (cfg.firewallProfiles == null) return t("securityFirewallQueryFailed");
  const disabled = cfg.firewallProfiles.filter((p) => !p.enabled);
  if (disabled.length === 0) return t("securityFirewallAllOn");
  if (cfg.thirdPartyFirewall)
    return t("securityFirewallThirdParty", { vendor: cfg.thirdPartyFirewall });
  return t("securityFirewallOff", { names: disabled.map((p) => p.name).join(", ") });
}

const TONE_STYLE: Record<Tone, { border: string; tint: string; text: string }> = {
  ok: {
    border: "border-success/30",
    tint: "bg-success-soft text-success-strong",
    text: "text-success-strong",
  },
  warn: {
    border: "border-warning/40",
    tint: "bg-warning-soft text-warning-strong",
    text: "text-warning-strong",
  },
  bad: {
    border: "border-destructive/40",
    tint: "bg-destructive-soft text-destructive-strong",
    text: "text-destructive-strong",
  },
  muted: {
    border: "border-border",
    tint: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
};

function PostureCard({
  icon,
  title,
  tone,
  value,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  tone: Tone;
  value: string;
  action?: React.ReactNode;
}) {
  const s = TONE_STYLE[tone];
  const ok = tone === "ok";
  return (
    <Card variant="default" className={cn("flex items-center gap-3 p-4", s.border)}>
      <span className={cn("shrink-0 w-9 h-9 rounded-md flex items-center justify-center", s.tint)}>
        {ok ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : tone === "muted" ? (
          icon
        ) : (
          <ShieldX className="w-4 h-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className={cn("text-xs", s.text)}>{value}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Card>
  );
}
