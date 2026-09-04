import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User, X } from "lucide-react";
import type { ChatMessage, ScanReport } from "@/lib/types";
import { aiChat, aiListModels, onAiDone, onAiError, onAiToken, toError } from "@/lib/api";
import { metricLabelFromCode, resolveFinding, useByteFmt, useI18n, useT } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";

interface Props {
  open: boolean;
  onClose: () => void;
  report: ScanReport | null;
}

type Status = "checking" | "ready" | "noOllama";

interface DisplayMsg {
  role: "user" | "assistant";
  content: string;
}

export function AiChatDrawer({ open, onClose, report }: Props) {
  const t = useT();
  const { locale } = useI18n();
  const fmtBytes = useByteFmt();

  const [status, setStatus] = useState<Status>("checking");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>("");
  const [messages, setMessages] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef("");

  // Faz 2 — "verileriniz yerel Ollama'ya gider" bildirimi ilk açılışta bir kez.
  const [showAiConsent, setShowAiConsent] = useState(false);
  const aiSettingsRef = useRef<AppSettings | null>(null);

  // Ollama durumunu kontrol et (drawer açılınca).
  useEffect(() => {
    if (!open) return;
    setStatus("checking");
    setError(null);
    aiListModels()
      .then((m) => {
        setModels(m);
        setModel((cur) => cur || m[0] || "");
        setStatus(m.length > 0 ? "ready" : "noOllama");
      })
      .catch(() => setStatus("noOllama"));
    getSettings()
      .then((s) => {
        aiSettingsRef.current = s;
        setShowAiConsent(!s.aiDisclosureAck);
      })
      .catch(() => {
        /* ayarlar okunamazsa bildirimi zorlamıyoruz — akışı bloklamaz */
      });
  }, [open]);

  const ackAiConsent = () => {
    setShowAiConsent(false);
    const base = aiSettingsRef.current;
    if (!base) return;
    const next = { ...base, aiDisclosureAck: true };
    saveSettings(next)
      .then((saved) => {
        aiSettingsRef.current = saved;
      })
      .catch((e) => console.warn("[ai] consent ack save failed:", e));
  };

  // Stream event dinleyicileri (bir kez).
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    onAiToken((chunk) => {
      streamRef.current += chunk;
      setStreamText(streamRef.current);
    }).then((u) => unlisteners.push(u));
    onAiDone(() => {
      const text = streamRef.current;
      streamRef.current = "";
      setStreamText("");
      setStreaming(false);
      if (text.trim()) {
        setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      }
    }).then((u) => unlisteners.push(u));
    onAiError((msg) => {
      streamRef.current = "";
      setStreamText("");
      setStreaming(false);
      setError(msg);
    }).then((u) => unlisteners.push(u));
    return () => unlisteners.forEach((u) => u());
  }, []);

  // Otomatik kaydır.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  const buildSystemMessage = (): ChatMessage => {
    const ctx = buildContext(report, locale, t, fmtBytes);
    return {
      role: "system",
      content: `${t("aiSystemPrompt")}\n\n${t("aiContextHeading")}:\n${ctx}`,
    };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || status !== "ready" || !model) return;
    setError(null);
    const nextDisplay: DisplayMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextDisplay);
    setInput("");
    setStreaming(true);
    streamRef.current = "";
    setStreamText("");
    const wire: ChatMessage[] = [
      buildSystemMessage(),
      ...nextDisplay.map((m) => ({ role: m.role, content: m.content })),
    ];
    try {
      await aiChat(model, wire);
    } catch (e) {
      setStreaming(false);
      setError(toError(e).message);
    }
  };

  const suggestions = report
    ? [t("aiSuggestExplain"), t("aiSuggestPriority"), t("aiSuggestSafe")]
    : [t("aiSuggestNoScan")];

  return (
    <>
      {/* arka plan */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* yan panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md bg-card border-l border-border shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-label={t("aiTitle")}
      >
        {/* başlık */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <span className="w-9 h-9 rounded-md bg-primary-soft text-primary-strong flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-foreground leading-tight">{t("aiTitle")}</h2>
            <p className="text-[11px] text-muted-foreground font-mono">{t("aiSubtitle")}</p>
          </div>
          {status === "ready" && models.length > 1 && (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-[11px] font-mono bg-background border border-border rounded-md px-2 py-1 max-w-[8rem]"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("aiClose")}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* gövde */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {showAiConsent && (
            <div className="rounded-lg border border-info/30 bg-info-soft/40 p-3.5 space-y-2 text-sm">
              <p className="font-semibold text-info-strong">{t("aiConsentTitle")}</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{t("aiConsentBody")}</p>
              <Button size="sm" variant="outline" onClick={ackAiConsent}>
                {t("aiConsentAck")}
              </Button>
            </div>
          )}

          {status === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("aiChecking")}
            </div>
          )}

          {status === "noOllama" && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 text-sm">
              <p className="font-semibold text-foreground">{t("aiNoOllamaTitle")}</p>
              <p className="text-muted-foreground leading-relaxed">{t("aiNoOllamaBody")}</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>{t("aiSetupStep1")}</li>
                <li>
                  {t("aiSetupStep2")}{" "}
                  <code className="px-1.5 py-0.5 rounded bg-foreground/90 text-background font-mono">
                    ollama pull llama3.2
                  </code>
                </li>
                <li>{t("aiSetupStep3")}</li>
              </ol>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStatus("checking");
                  aiListModels()
                    .then((m) => {
                      setModels(m);
                      setModel((cur) => cur || m[0] || "");
                      setStatus(m.length > 0 ? "ready" : "noOllama");
                    })
                    .catch(() => setStatus("noOllama"));
                }}
              >
                {t("aiRetry")}
              </Button>
            </div>
          )}

          {status === "ready" && messages.length === 0 && !streaming && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-md bg-primary-soft text-primary-strong flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </span>
                <p className="text-sm text-foreground/90 leading-relaxed pt-1">{t("aiGreeting")}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInput(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-card hover:border-primary/40 hover:bg-secondary transition-colors text-foreground/80"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {streaming && <Bubble role="assistant" content={streamText} streaming />}

          {error && (
            <div className="rounded-md bg-destructive-soft/60 text-destructive-strong text-xs p-3">
              {error}
            </div>
          )}
        </div>

        {/* giriş */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={status === "ready" ? t("aiPlaceholder") : t("aiDisabledPlaceholder")}
              disabled={status !== "ready" || streaming}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm",
                "max-h-32 focus:outline-none focus:border-primary/50 disabled:opacity-50"
              )}
            />
            <Button
              size="icon"
              onClick={() => void send()}
              disabled={status !== "ready" || streaming || !input.trim()}
              aria-label={t("aiSend")}
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">{t("aiDisclaimer")}</p>
        </div>
      </aside>
    </>
  );
}

function Bubble({
  role,
  content,
  streaming = false,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex items-start gap-2.5", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
          isUser ? "bg-secondary text-foreground" : "bg-primary-soft text-primary-strong"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </span>
      <div
        className={cn(
          "rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[85%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
        )}
      >
        {content}
        {streaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

/** Tarama raporunu modele verilecek okunur (PII-temiz) bağlama çevirir. */
function buildContext(
  report: ScanReport | null,
  locale: "tr" | "en",
  t: ReturnType<typeof useT>,
  fmtBytes: (b: number) => string
): string {
  if (!report) return t("aiCtxNoScan");
  const lines: string[] = [];
  lines.push(`${t("aiCtxScore")}: ${report.health.score}/100`);
  if (report.findings.length === 0) {
    lines.push(t("aiCtxNoFindings"));
  } else {
    lines.push(`${t("aiCtxFindings")}:`);
    for (const f of report.findings) {
      const r = resolveFinding(f, locale);
      const metric = f.metricCode ? metricLabelFromCode(f.metricCode, locale) : (f.metric ?? "");
      lines.push(`- [${f.category}] ${r.title}${metric ? ` (${metric})` : ""} — ${f.severity}`);
    }
  }
  if (report.volumes.length > 0) {
    lines.push(`${t("aiCtxDrives")}:`);
    for (const v of report.volumes) {
      lines.push(
        `- ${v.mountPoint.replace(/\\$/, "")} ${fmtBytes(v.usedBytes)}/${fmtBytes(v.totalBytes)} (%${v.usedPercent.toFixed(0)})`
      );
    }
  }
  return lines.join("\n");
}
