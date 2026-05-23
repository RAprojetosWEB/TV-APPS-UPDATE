import { useEffect, useRef, useState } from "react";
import { RefreshCcw, Download, X } from "lucide-react";
import type { UpdateManifest } from "@/lib/app-version";

type Props = {
  open: boolean;
  manifest: UpdateManifest | null;
  installedVersion: string;
  downloading: boolean;
  progress: number;
  speedBps?: number;
  onUpdate: () => void;
  onLater: () => void;
};

function formatSpeed(bps = 0): string {
  if (bps <= 0) return "—";
  const mbps = bps / 1024 / 1024;
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

export function OtaUpdateModal({
  open,
  manifest,
  installedVersion,
  downloading,
  progress,
  speedBps = 0,
  onUpdate,
  onLater,
}: Props) {
  const [choice, setChoice] = useState<"yes" | "no">("yes");
  const yesRef = useRef<HTMLButtonElement | null>(null);
  const noRef = useRef<HTMLButtonElement | null>(null);
  const force = !!manifest?.forceUpdate;

  useEffect(() => {
    if (open) {
      setChoice("yes");
      if (!downloading) setTimeout(() => yesRef.current?.focus(), 0);
    }
  }, [open, downloading]);

  useEffect(() => {
    if (!open || downloading) return;
    if (choice === "yes") yesRef.current?.focus();
    else noRef.current?.focus();
  }, [choice, open, downloading]);

  if (!open || !manifest) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (downloading) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (!force) setChoice((c) => (c === "yes" ? "no" : "yes"));
    } else if ((e.key === "Escape" || e.key === "Backspace") && !force) {
      e.preventDefault();
      onLater();
    }
  };

  return (
    <div
      onKeyDown={handleKey}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "oklch(0 0 0 / 0.85)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="flex w-[640px] max-w-[92vw] flex-col items-center rounded-3xl p-10"
        style={{
          background: "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
          border: "3px solid #f97316",
          boxShadow: "0 30px 100px -10px rgba(249, 115, 22, 0.55), 0 0 0 8px rgba(249, 115, 22, 0.15)",
        }}
      >
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
        >
          <RefreshCcw size={56} strokeWidth={2.5} color="white" />
        </div>

        <h2 className="text-4xl font-black text-white text-center leading-tight">
          {force ? "Atualização obrigatória" : "Nova versão disponível!"}
        </h2>
        <p className="mt-3 text-center text-lg text-white/70">
          {force
            ? "Esta atualização é necessária para continuar usando o app."
            : "Uma nova versão do TV.Apps está pronta para instalar."}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 w-full px-2">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col items-center">
            <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">
              Instalada
            </span>
            <span className="text-2xl font-black text-white/60">{installedVersion}</span>
          </div>
          <div className="bg-orange-500/10 rounded-2xl p-4 border border-orange-500/30 flex flex-col items-center">
            <span className="text-xs text-orange-400 uppercase font-bold tracking-wider mb-1">
              Nova versão
            </span>
            <span className="text-2xl font-black text-orange-400">{manifest.version}</span>
          </div>
        </div>

        {manifest.changelog && (
          <div className="mt-6 w-full rounded-2xl bg-white/5 border border-white/10 p-5 max-h-40 overflow-auto">
            <div className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2">
              Novidades da versão {manifest.version}
            </div>
            <p className="text-base text-white/80 whitespace-pre-line">{manifest.changelog}</p>
          </div>
        )}

        {downloading ? (
          <div className="mt-8 w-full rounded-3xl border border-orange-400/20 bg-white/5 p-5 shadow-[0_0_40px_rgba(249,115,22,0.18)_inset]">
            <div className="mb-3 flex items-end justify-between gap-4">
              <span className="text-sm font-bold uppercase tracking-[0.18em] text-white/55">
                Baixando atualização
              </span>
              <span className="text-4xl font-black tabular-nums text-orange-400">
                {progress}%
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full border border-white/10" style={{ background: "oklch(0.22 0.04 270)" }}>
              <div
                className="h-full rounded-full transition-all duration-300 shadow-[0_0_24px_rgba(249,115,22,0.7)]"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #f97316, #fbbf24)",
                }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-white/80">
              <span className="text-sm font-semibold uppercase tracking-wider text-white/45">Velocidade</span>
              <span className="text-xl font-black tabular-nums text-white">{formatSpeed(speedBps)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex gap-5 w-full">
            <button
              ref={yesRef}
              onFocus={() => setChoice("yes")}
              onClick={onUpdate}
              className="flex-1 rounded-2xl px-8 py-5 text-xl font-black outline-none transition-all flex items-center justify-center gap-3"
              style={{
                background:
                  choice === "yes"
                    ? "linear-gradient(135deg, #f97316, #ea580c)"
                    : "oklch(0.28 0.04 270)",
                color: "white",
                border: `3px solid ${choice === "yes" ? "#f97316" : "var(--tv-card-border)"}`,
                transform: choice === "yes" ? "scale(1.05)" : "scale(1)",
              }}
            >
              <Download size={22} />
              Atualizar agora
            </button>
            {!force && (
              <button
                ref={noRef}
                onFocus={() => setChoice("no")}
                onClick={onLater}
                className="flex-1 rounded-2xl px-8 py-5 text-xl font-bold outline-none transition-all flex items-center justify-center gap-3"
                style={{
                  background:
                    choice === "no"
                      ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                      : "oklch(0.28 0.04 270)",
                  color: choice === "no" ? "oklch(0.15 0.03 270)" : "white",
                  border: `3px solid ${choice === "no" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                  transform: choice === "no" ? "scale(1.05)" : "scale(1)",
                }}
              >
                <X size={22} />
                Depois
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}