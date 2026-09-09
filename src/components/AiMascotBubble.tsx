import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";

interface Props {
  /** Gösterilecek soru metni (zaten locale'e göre çözülmüş). */
  text: string;
  /** "floating": sağ-alt köşede belirir, birkaç saniye sonra kendiliğinden
   *  soluklaşır. "inline": panelin içine gömülü, kalıcı şerit — hiç solmaz. */
  variant: "floating" | "inline";
  /** Tıklanınca (maskota veya balona) — sohbeti o soruyla açar. */
  onOpenChat: () => void;
}

const FLOATING_VISIBLE_MS = 6000;

export function AiMascotBubble({ text, variant, onOpenChat }: Props) {
  const [visible, setVisible] = useState(true);

  // Floating varyant birkaç saniye sonra kendiliğinden solur — App state'ini
  // etkilemez (inline varyant aynı `text` ile panelde göstermeye devam eder).
  useEffect(() => {
    if (variant !== "floating") return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), FLOATING_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [variant, text]);

  if (variant === "floating") {
    return (
      <div
        className={cn(
          "fixed bottom-5 right-5 z-30 flex items-end gap-2.5 max-w-xs",
          "transition-opacity duration-500",
          visible ? "opacity-100 animate-bounce-in" : "opacity-0 pointer-events-none"
        )}
        role="status"
        aria-hidden={!visible}
      >
        <button
          type="button"
          onClick={onOpenChat}
          aria-label={text}
          tabIndex={visible ? 0 : -1}
          className="shrink-0 w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg animate-pulse-glow"
        >
          <BrandMark size="sm" />
        </button>
        <button
          type="button"
          onClick={onOpenChat}
          tabIndex={visible ? 0 : -1}
          className="text-left rounded-lg border border-primary/40 bg-card px-3 py-2.5 text-xs leading-relaxed text-foreground shadow-md hover:border-primary/70 transition-colors"
        >
          {text}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary-soft/20 px-3.5 py-3 mb-2.5 animate-fade-in">
      <span className="shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
        <BrandMark size="sm" />
      </span>
      <button
        type="button"
        onClick={onOpenChat}
        className="text-left text-sm leading-relaxed text-foreground hover:text-primary-strong transition-colors"
      >
        {text}
      </button>
    </div>
  );
}
