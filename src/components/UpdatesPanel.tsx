import { useState } from "react";
import { CheckCircle2, Download, ExternalLink, Loader2, Package, ShieldAlert } from "lucide-react";
import type { PendingUpdate, UpdateSnapshot } from "@/lib/types";
import { openOemLink, toError, updateSnapshot } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

/** Güncellemeler kategorisi — bekleyen Windows Update + winget (butonla kontrol, yavaş sorgu). */
export function UpdatesPanel() {
  const t = useT();
  const [snap, setSnap] = useState<UpdateSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = () => {
    setLoading(true);
    setError(null);
    updateSnapshot()
      .then(setSnap)
      .catch((e) => setError(toError(e).message))
      .finally(() => setLoading(false));
  };

  const wu = snap?.windowsUpdates ?? null;
  const securityCount = wu?.filter((u) => u.isSecurity).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("updatesHeading")}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openOemLink("ms-settings:windowsupdate").catch(() => {})}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t("updatesOpenWu")}
        </Button>
      </div>

      {/* kontrol butonu */}
      {!snap && !loading && (
        <Card variant="default" className="p-5 text-center space-y-3">
          <Download className="w-8 h-8 mx-auto text-primary" />
          <p className="text-sm text-foreground/90">{t("updatesIntro")}</p>
          <Button onClick={check}>
            <Download className="w-4 h-4" />
            {t("updatesCheckCta")}
          </Button>
          <p className="text-[11px] text-muted-foreground">{t("updatesSlowNote")}</p>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-1 py-8 text-sm text-muted-foreground justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("updatesChecking")}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
          {error}
        </div>
      )}

      {snap && !loading && (
        <>
          {/* Windows Update */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              {t("updatesWuTitle")}
            </span>
            <button
              type="button"
              onClick={check}
              className="text-[11px] font-mono text-primary hover:text-primary-strong"
            >
              {t("updatesRecheck")}
            </button>
          </div>

          {wu == null ? (
            <Card variant="default" className="p-4 text-xs text-muted-foreground">
              {t("updatesWuFailed")}
            </Card>
          ) : wu.length === 0 ? (
            <Card
              variant="default"
              className="p-4 flex items-center gap-2 text-sm text-foreground/90"
            >
              <CheckCircle2 className="w-4 h-4 text-success" />
              {t("updatesWuNone")}
            </Card>
          ) : (
            <>
              {securityCount > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-destructive-soft/50 text-destructive-strong text-xs p-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {t("updatesSecurityWarn", { count: securityCount })}
                </div>
              )}
              <div className="space-y-1.5">
                {wu.slice(0, 30).map((u, i) => (
                  <UpdateRow key={i} update={u} />
                ))}
              </div>
            </>
          )}

          {/* winget */}
          {snap.wingetUpgradeCount != null && snap.wingetUpgradeCount > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 px-1">
                <Package className="w-3.5 h-3.5" />
                {t("updatesWingetTitle", { count: snap.wingetUpgradeCount })}
              </span>
              <Card variant="default" className="p-3">
                <p className="text-xs text-muted-foreground mb-1.5">{t("updatesWingetHint")}</p>
                <code className="block rounded bg-foreground/95 text-background/90 px-2.5 py-1.5 text-xs font-mono">
                  winget upgrade --all
                </code>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UpdateRow({ update }: { update: PendingUpdate }) {
  return (
    <Card
      variant="default"
      className={cn(
        "flex items-center gap-3 p-3",
        update.isSecurity ? "border-destructive/30" : "border-border"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
          update.isSecurity
            ? "bg-destructive-soft text-destructive-strong"
            : "bg-primary-soft text-primary-strong"
        )}
      >
        {update.isSecurity ? <ShieldAlert className="w-4 h-4" /> : <Download className="w-4 h-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground truncate" title={update.title}>
          {update.title}
        </div>
        {update.kb && (
          <div className="text-[11px] font-mono text-muted-foreground">{update.kb}</div>
        )}
      </div>
      {update.severity && (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-muted text-muted-foreground uppercase">
          {update.severity}
        </span>
      )}
    </Card>
  );
}
