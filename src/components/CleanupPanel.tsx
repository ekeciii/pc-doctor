import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import type { CleanupTarget } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useByteFmt, useNumberFmt, useT } from "@/lib/i18n";

interface Props {
  targets: CleanupTarget[];
  totalBytes: number;
  onFix: (ids: string[]) => void;
  busy: boolean;
}

export function CleanupPanel({ targets, totalBytes, onFix, busy }: Props) {
  const t = useT();
  const fmtBytes = useByteFmt();
  const numberFmt = useNumberFmt();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(targets.map((x) => x.id))
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const selectedBytes = useMemo(
    () => targets.filter((x) => selected.has(x.id)).reduce((a, b) => a + b.sizeBytes, 0),
    [targets, selected]
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (targets.length === 0) {
    return (
      <Card>
        <div className="p-5 text-sm text-muted-foreground">{t("emptyCleanup")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card tone="primary" variant="flat" className="border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-3 p-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("totalReclaimable")}
            </div>
            <div className="font-display text-3xl font-extrabold text-primary-strong tracking-tight">
              {fmtBytes(totalBytes)}
            </div>
          </div>
          <Button
            onClick={() => onFix([...selected])}
            disabled={busy || selected.size === 0}
            size="lg"
          >
            <Trash2 className="w-4 h-4" />
            {t("fixAll")} ({fmtBytes(selectedBytes)})
          </Button>
        </div>
      </Card>

      <ul className="space-y-2">
        {targets.map((target) => {
          const checked = selected.has(target.id);
          const open = expanded === target.id;
          return (
            <li key={target.id}>
              <Card variant="default" className="overflow-hidden">
                <div className="flex items-center gap-3 p-3.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(target.id)}
                    className="w-5 h-5 accent-primary cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <div className="font-display font-semibold text-foreground truncate">
                        {target.label}
                      </div>
                      <code className="text-xs text-muted-foreground font-mono truncate">
                        {target.path}
                      </code>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {numberFmt.format(target.itemCount)} {t("items")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-primary-strong tabular-nums">
                      {fmtBytes(target.sizeBytes)}
                    </div>
                    <button
                      onClick={() => setExpanded(open ? null : target.id)}
                      className={cn(
                        "text-xs text-muted-foreground inline-flex items-center gap-0.5",
                        "hover:text-primary transition-colors"
                      )}
                    >
                      {open ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {open ? t("hide") : t("detail")}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="px-12 pb-3 text-sm text-muted-foreground border-t border-border pt-2.5">
                    {target.description}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
