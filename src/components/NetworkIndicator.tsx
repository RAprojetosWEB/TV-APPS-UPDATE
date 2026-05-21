import { useState, useEffect } from "react";
import { Wifi, Globe, SignalHigh, SignalLow, WifiOff, Zap } from "lucide-react";

type ConnectionType = "wifi" | "ethernet" | "cellular" | "none" | "unknown";

interface NetworkStatus {
  online: boolean;
  type: ConnectionType;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    type: "unknown",
  });

  useEffect(() => {
    const updateStatus = () => {
      let type: ConnectionType = "unknown";
      
      // Intentar obter o tipo de conexão via Network Information API
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      if (conn) {
        if (conn.type === "wifi") type = "wifi";
        else if (conn.type === "ethernet") type = "ethernet";
        else if (conn.type === "cellular") type = "cellular";
        else if (conn.effectiveType && conn.effectiveType.includes("2g")) type = "cellular";
        else if (conn.effectiveType) type = "wifi"; // Fallback para WiFi se houver velocidade mas tipo desconhecido
      }

      setStatus({
        online: navigator.onLine,
        type: navigator.onLine ? type : "none",
      });
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      conn.addEventListener("change", updateStatus);
    }

    updateStatus();

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      if (conn) {
        conn.removeEventListener("change", updateStatus);
      }
    };
  }, []);

  return status;
}

export function NetworkIndicator({ compact = false }: { compact?: boolean } = {}) {
  const { online, type } = useNetworkStatus();
  const [showToast, setShowToast] = useState(false);
  const [lastOnline, setLastOnline] = useState(online);

  useEffect(() => {
    if (online !== lastOnline) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 3000);
      setLastOnline(online);
      return () => clearTimeout(timer);
    }
  }, [online, lastOnline]);

  const getIcon = () => {
    if (!online) return <WifiOff className="text-destructive animate-pulse" size={20} />;
    
    switch (type) {
      case "ethernet":
        return <Zap className="text-tv-accent" size={20} />;
      case "cellular":
        return <SignalHigh className="text-tv-accent" size={20} />;
      case "wifi":
      default:
        return <Wifi className="text-tv-accent" size={20} />;
    }
  };

  const getLabel = () => {
    if (!online) return "Sem conexão";
    switch (type) {
      case "ethernet": return "Ethernet";
      case "cellular": return "Dados Móveis";
      case "wifi": return "Wi-Fi";
      default: return "Conectado";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            online ? "bg-tv-accent/10 border-tv-accent/30 text-tv-accent" : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}>
            {online ? <Globe size={20} /> : <WifiOff size={20} />}
            <span className="font-bold text-lg">
              {online ? "Conexão restaurada" : "Internet desconectada"}
            </span>
          </div>
        </div>
      )}

      {/* Main Indicator */}
      {compact ? (
        <div
          aria-label={getLabel()}
          title={getLabel()}
          className={`flex items-center justify-center w-[60px] h-[60px] rounded-2xl border-2 backdrop-blur-md transition-all duration-300 hover:scale-105 ${
            online
              ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              : "bg-destructive/10 border-destructive/40 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
          }`}
        >
          {getIcon()}
        </div>
      ) : (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-500 border ${
          online 
            ? "bg-white/5 border-white/10" 
            : "bg-destructive/10 border-destructive/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        }`}>
          {getIcon()}
          <span className={`text-lg font-medium tracking-tight ${online ? "text-white/80" : "text-destructive"}`}>
            {getLabel()}
          </span>
        </div>
      )}
    </div>
  );
}
