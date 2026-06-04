import { HardDrive } from "lucide-react";
import { Card, CardContent } from "./ui/Card";
import { Progress } from "./ui/Progress";
import type { VolumeInfo } from "@/lib/types";
import { useByteFmt, useT } from "@/lib/i18n";

export function VolumeGrid({ volumes }: { volumes: VolumeInfo[] }) {
  const t = useT();
  const fmtBytes = useByteFmt();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {volumes.map((v, i) => {
        const usedPct = Math.min(100, Math.max(0, v.usedPercent));
        const tone =
          usedPct >= 90 ? "destructive" : usedPct >= 85 ? "warning" : "primary";
        return (
          <Card
            key={v.mountPoint}
            variant="default"
            className="animate-rise-in hover:shadow-md transition-shadow"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <CardContent className="p-4 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-4 h-4 text-primary" />
                <div className="font-display font-semibold text-base text-foreground">
                  {v.mountPoint.replace(/\\$/, "")}
                </div>
                {v.label && (
                  <span className="text-xs text-muted-foreground">({v.label})</span>
                )}
              </div>
              <Progress value={usedPct} tone={tone} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>
                  {t("used")}:{" "}
                  <span className="font-medium text-foreground/90">
                    {fmtBytes(v.usedBytes)}
                  </span>
                </span>
                <span>
                  {t("freeSpace")}:{" "}
                  <span className="font-medium text-foreground/90">
                    {fmtBytes(v.freeBytes)}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
