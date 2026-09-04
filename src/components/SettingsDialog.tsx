import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Alert, AlertDescription } from "./ui/Alert";
import { ConfirmDialog } from "./ConfirmDialog";
import { useI18n, useT, type Locale } from "@/lib/i18n";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";
import { clearHistory, openOemLink } from "@/lib/api";

const PRIVACY_URL = "https://github.com/ekeciii/pc-doctor/blob/main/PRIVACY.md";
const EULA_URL = "https://github.com/ekeciii/pc-doctor/blob/main/EULA.md";

interface Props {
  open: boolean;
  onClose: () => void;
  onShowHistory: () => void;
}

export function SettingsDialog({ open, onClose, onShowHistory }: Props) {
  const t = useT();
  const { setLocale } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearedOk, setClearedOk] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setClearedOk(false);
    getSettings()
      .then(setSettings)
      .catch((e) => setError(`${t("settingsSaveFailed")}: ${String(e)}`));
  }, [open, t]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveSettings(settings);
      setSettings(saved);
      // Sync I18nProvider state to the saved locale.
      await setLocale((saved.locale === "en" ? "en" : "tr") as Locale);
      applyTheme(saved.theme);
      onClose();
    } catch (e) {
      setError(`${t("settingsSaveFailed")}: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const requestClearHistory = () => setClearConfirmOpen(true);

  const confirmClearHistory = async () => {
    setClearConfirmOpen(false);
    setClearing(true);
    setClearedOk(false);
    setError(null);
    try {
      await clearHistory();
      setClearedOk(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setClearing(false);
    }
  };

  const handleRetentionChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return; // Boş veya geçersiz → mevcut değeri koru
    const clamped = Math.max(1, Math.min(3650, n));
    update("historyRetentionDays", clamped);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex-1">
              <DialogTitle>{t("settingsTitle")}</DialogTitle>
              <DialogDescription className="mt-1">
                {t("settingsAboutBody")}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {clearedOk && (
              <Alert variant="success">
                <CheckCircle2 />
                <AlertDescription>{t("historyClearSuccess")}</AlertDescription>
              </Alert>
            )}

            {settings && (
              <>
                {/* Language */}
                <section className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    {t("settingsLanguage")}
                  </label>
                  <div className="flex gap-2">
                    {(["tr", "en"] as const).map((loc) => (
                      <Button
                        key={loc}
                        variant={settings.locale === loc ? "default" : "outline"}
                        size="default"
                        onClick={() => update("locale", loc)}
                      >
                        {loc === "tr" ? t("settingsLanguageTr") : t("settingsLanguageEn")}
                      </Button>
                    ))}
                  </div>
                </section>

                {/* Theme */}
                <section className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    {t("settingsTheme")}
                  </label>
                  <div className="flex gap-2">
                    {(["auto", "light", "dark"] as const).map((th) => (
                      <Button
                        key={th}
                        variant={settings.theme === th ? "default" : "outline"}
                        size="default"
                        onClick={() => update("theme", th)}
                      >
                        {th === "auto"
                          ? t("settingsThemeAuto")
                          : th === "light"
                            ? t("settingsThemeLight")
                            : t("settingsThemeDark")}
                      </Button>
                    ))}
                  </div>
                </section>

                {/* History */}
                <section className="space-y-2 border-t border-border pt-5">
                  <label className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>{t("settingsHistory")}</span>
                    <input
                      type="checkbox"
                      checked={settings.historyEnabled}
                      onChange={(e) => update("historyEnabled", e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t("settingsHistoryExplain")}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <label className="text-sm text-muted-foreground">
                      {t("settingsHistoryRetention")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={settings.historyRetentionDays}
                      onChange={(e) => handleRetentionChange(e.target.value)}
                      className="w-20 px-2 py-1 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("historyRetentionHelper")}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onShowHistory();
                      }}
                    >
                      {t("settingsShowHistory")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={requestClearHistory}
                      disabled={clearing}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("settingsClearHistory")}
                    </Button>
                  </div>
                </section>

                {/* Privacy / legal */}
                <section className="space-y-2 border-t border-border pt-5">
                  <label className="text-sm font-semibold text-foreground">
                    {t("settingsPrivacyHeading")}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t("settingsPrivacyExplain")}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openOemLink(PRIVACY_URL).catch(() => {});
                      }}
                    >
                      {t("settingsPrivacyLink")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openOemLink(EULA_URL).catch(() => {});
                      }}
                    >
                      {t("settingsEulaLink")}
                    </Button>
                  </div>
                </section>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("settingsClose")}
            </Button>
            <Button onClick={save} disabled={saving || !settings}>
              {t("settingsSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={clearConfirmOpen}
        bodyLines={[t("historyClearConfirm")]}
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={confirmClearHistory}
      />
    </>
  );
}

/**
 * Apply theme by toggling .dark class on <html>.
 * "auto" defers to system preference AND attaches a media-query listener so
 * later system changes are reflected. A previous listener (if any) is replaced.
 */
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;
let mediaQuery: MediaQueryList | null = null;

export function applyTheme(theme: AppSettings["theme"]) {
  const root = document.documentElement;
  // Tear down any previous "auto" listener — we only keep one.
  if (mediaListener && mediaQuery) {
    mediaQuery.removeEventListener("change", mediaListener);
    mediaListener = null;
    mediaQuery = null;
  }

  if (theme === "dark") {
    root.classList.add("dark");
    return;
  }
  if (theme === "light") {
    root.classList.remove("dark");
    return;
  }
  // auto
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = (prefersDark: boolean) => {
    if (prefersDark) root.classList.add("dark");
    else root.classList.remove("dark");
  };
  sync(mediaQuery.matches);
  mediaListener = (e) => sync(e.matches);
  mediaQuery.addEventListener("change", mediaListener);
}
