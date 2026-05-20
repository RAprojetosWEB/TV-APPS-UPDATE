import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Play, Tv } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "TV Apps — Central de Downloads" },
      { name: "description", content: "Baixe seus apps favoritos direto na sua TV Box." },
    ],
  }),
});

// ⬇️ SUBSTITUA AS URLs ABAIXO PELOS LINKS DIRETOS DOS SEUS APKs ⬇️
const APPS = [
  {
    name: "UniTV",
    description: "Streaming de filmes e séries",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
    Icon: Play,
  },
  {
    name: "Nexa TV",
    description: "Player de mídia universal",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
    Icon: Tv,
  },
  {
    name: "AllApp",
    description: "Tudo em um só app",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/AllApp.apk",
    Icon: Download,
  },
];

function Index() {
  const [focused, setFocused] = useState(1);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    refs.current[focused]?.focus();
  }, [focused]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocused((i) => Math.min(APPS.length - 1, i + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocused((i) => Math.max(0, i - 1));
    }
  };

  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <main
      onKeyDown={handleKey}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, oklch(0.3 0.12 280 / 0.4), transparent 60%), radial-gradient(ellipse at bottom right, oklch(0.3 0.12 150 / 0.35), transparent 60%)",
      }}
    >
      <header className="px-16 pt-10">
        <h1 className="text-5xl font-black tracking-tight">
          TV<span style={{ color: "var(--tv-accent)" }}>.</span>Apps
        </h1>
        <p className="mt-2 text-lg text-white/60">
          Use as setas do controle e pressione OK para baixar
        </p>
      </header>

      <section className="flex flex-1 items-center justify-center gap-10 px-16">
        {APPS.map((app, i) => {
          const isFocused = focused === i;
          const Icon = app.Icon;
          return (
            <button
              key={app.name}
              ref={(el) => {
                refs.current[i] = el;
              }}
              tabIndex={0}
              onFocus={() => setFocused(i)}
              onClick={() => open(app.url)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(app.url);
                }
              }}
              className="group relative flex h-[460px] w-[360px] flex-col items-center justify-center rounded-3xl outline-none transition-all duration-300"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: `3px solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                transform: isFocused ? "scale(1.08)" : "scale(1)",
                boxShadow: isFocused
                  ? "0 25px 80px -10px oklch(0.78 0.22 150 / 0.55), 0 0 0 6px oklch(0.78 0.22 150 / 0.15)"
                  : "0 10px 30px -10px oklch(0 0 0 / 0.5)",
              }}
            >
              <div
                className="mb-8 flex h-32 w-32 items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  background: isFocused
                    ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                    : "oklch(0.28 0.04 270)",
                }}
              >
                <Icon
                  className="transition-all"
                  size={64}
                  strokeWidth={1.8}
                  color={isFocused ? "oklch(0.15 0.03 270)" : "white"}
                />
              </div>
              <h2 className="text-3xl font-bold">{app.name}</h2>
              <p className="mt-3 px-6 text-center text-base text-white/60">
                {app.description}
              </p>
              <div
                className="mt-8 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all"
                style={{
                  background: isFocused ? "var(--tv-accent)" : "transparent",
                  color: isFocused ? "oklch(0.15 0.03 270)" : "white",
                  border: `2px solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                }}
              >
                <Download size={16} />
                BAIXAR APK
              </div>
            </button>
          );
        })}
      </section>

      <footer className="px-16 pb-8 text-center text-sm text-white/40">
        Após o download, abra o arquivo APK e permita instalação de fontes desconhecidas
      </footer>
    </main>
  );
}
