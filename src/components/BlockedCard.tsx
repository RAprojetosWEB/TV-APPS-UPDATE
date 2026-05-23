import { Lock } from "lucide-react";

interface BlockedCardProps {
  reason?: string | null;
}

/**
 * Card neutro exibido no lugar de um app bloqueado.
 * Não mostra logo, nome ou qualquer identificação do app original.
 * Não recebe foco do controle remoto.
 */
export function BlockedCard({ reason }: BlockedCardProps) {
  return (
    <div
      aria-hidden="true"
      tabIndex={-1}
      className="group relative flex h-[90%] self-center w-full max-w-[clamp(280px,25vw,420px)] max-h-[90%] min-h-0 flex-col items-center justify-center rounded-[clamp(1.5rem,3vw,3rem)] outline-none mx-auto p-[clamp(1rem,2.5vh,2rem)] overflow-hidden cursor-default select-none"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.22 0.01 270), oklch(0.16 0.01 270))",
        border: "clamp(2px, 0.4vw, 4px) solid oklch(0.30 0.01 270)",
        boxShadow: "0 10px 30px -10px oklch(0 0 0 / 0.5)",
      }}
    >
      <div
        className="tv-icon-container mb-[clamp(0.5rem,2vh,2rem)] flex items-center justify-center rounded-2xl"
        style={{ background: "oklch(0.28 0.01 270)" }}
      >
        <Lock
          className="w-1/2 h-1/2"
          strokeWidth={1.8}
          color="oklch(0.55 0.01 270)"
        />
      </div>
      <h2
        className="text-[clamp(1.25rem,2.5vw,2.25rem)] font-bold text-center"
        style={{ color: "oklch(0.65 0.01 270)" }}
      >
        Indisponível
      </h2>
      <p
        className="mt-[clamp(0.25rem,1vh,1rem)] px-4 text-center text-[clamp(0.8rem,1.4vw,1.15rem)] line-clamp-2"
        style={{ color: "oklch(0.55 0.01 270)" }}
      >
        {reason && reason.trim().length > 0 ? reason : "Em manutenção"}
      </p>
    </div>
  );
}