import React, { useEffect, useMemo, useState } from "react";
import { makeSocket } from "./api";
import Home from "./pages/Home.jsx";
import Host from "./pages/Host.jsx";
import Join from "./pages/Join.jsx";
import Player from "./pages/Player.jsx";

function route() {
  const h = window.location.hash.replace("#", "");
  return h || "/";
}

export default function App() {
  const socket = useMemo(() => makeSocket(), []);
  const [r, setR] = useState(route());
  const [toast, setToast] = useState(null);
  const [numberDrawn, setNumberDrawn] = useState(null);
  const [winEvent, setWinEvent] = useState(null);
  
  // Stato per disabilitare i popup (caricato da localStorage)
  const [popupsEnabled, setPopupsEnabled] = useState(() => {
    const saved = localStorage.getItem('tombola_popupsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    const onHash = () => setR(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // Salva lo stato dei popup in localStorage quando cambia
    localStorage.setItem('tombola_popupsEnabled', JSON.stringify(popupsEnabled));
  }, [popupsEnabled]);

  useEffect(() => {
    const onNumberDrawn = (data) => {
      if (popupsEnabled) {
        setNumberDrawn(data.number);
        setTimeout(() => setNumberDrawn(null), 3000);
      }
    };
    
    const onWin = (ev) => {
      // Mostra popup solo per il PRIMO ambo/terno/quaterna/cinquina e per TUTTE le tombola
      const shouldShowPopup = ev.isFirst || ev.type === "tombola";
      if (shouldShowPopup && popupsEnabled) {
        setWinEvent(ev);
        setTimeout(() => setWinEvent(null), 5000);
      }
      
      // Toast per tutte le vincite (sempre visibile)
      const winType = ev.type === "tombola" ? "TOMBOLA" : ev.type.toUpperCase();
      setToast(`🎉 ${ev.playerName} ha fatto ${winType} (cartella ${ev.cardId})`);
    };
    
    socket.on("number:drawn", onNumberDrawn);
    socket.on("win:event", onWin);
    
    return () => {
      socket.off("number:drawn", onNumberDrawn);
      socket.off("win:event", onWin);
    };
  }, [socket, popupsEnabled]);

  const togglePopups = () => {
    setPopupsEnabled(prev => !prev);
    setToast(popupsEnabled ? "🔕 Popup disabilitati" : "🔔 Popup abilitati");
  };

  const Page = (() => {
    if (r === "/") return <Home />;
    if (r === "/host") return <Host socket={socket} onToast={setToast} />;
    if (r === "/join") return <Join socket={socket} onToast={setToast} />;
    if (r === "/player") return <Player socket={socket} onToast={setToast} />;
    return <Home />;
  })();

  return (
    <>
      <div className="snow" />
      <div className="app-shell">
        <div className="container">
          <div className="xmas-header">
            <div className="xmas-title">
              <div style={{ fontSize: 22 }}>🎄</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: ".2px" }}>Tombola Natalizia</div>
                <div className="small">Gioco casalingo • punti "Babbi Natali" • solo per divertirsi</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button 
                className="btn" 
                onClick={togglePopups}
                style={{
                  background: popupsEnabled ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                  borderColor: popupsEnabled ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
                  color: popupsEnabled ? "#22c55e" : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                {popupsEnabled ? (
                  <>
                    <span style={{ fontSize: 16 }}>🔔</span>
                    <span>Disabilita Popup</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 16 }}>🔕</span>
                    <span>Abilita Popup</span>
                  </>
                )}
              </button>
              <div className="xmas-badge">✨ <b>Home</b> edition</div>
            </div>
          </div>

          <div style={{ height: 14 }} />
          {toast && <div className="toast">{toast}</div>}
          {Page}
        </div>
      </div>

      {/* Popup numero estratto - mostrato solo se popupsEnabled = true */}
      {popupsEnabled && numberDrawn && (
        <NumberDrawnPopup number={numberDrawn} onClose={() => setNumberDrawn(null)} />
      )}
      
      {/* Popup vincita - mostrato solo se popupsEnabled = true */}
      {popupsEnabled && winEvent && (
        <WinCelebration event={winEvent} onClose={() => setWinEvent(null)} />
      )}
    </>
  );
}

function NumberDrawnPopup({ number, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
        textAlign: "center",
        background: "linear-gradient(135deg, rgba(34,197,94,0.9), rgba(245,158,11,0.9))",
        border: "3px solid rgba(255,255,255,0.5)",
        animation: "pulse 1s infinite alternate"
      }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>🎲</div>
        <h2 style={{ color: "#fff", margin: 0, fontSize: 32 }}>NUMERO ESTRATTO</h2>
        <div style={{ 
          fontSize: 120, 
          fontWeight: 900, 
          margin: "30px 0",
          color: "#fff",
          textShadow: "0 0 20px rgba(0,0,0,0.5)"
        }}>
          {number}
        </div>
        <div className="small" style={{ color: "#fff", fontSize: 16 }}>
          Clicca per chiudere
        </div>
      </div>
    </div>
  );
}

function WinCelebration({ event, onClose }) {
  const getTitle = () => {
    if (event.type === "tombola") return "TOMBOLA! 🏆";
    if (event.isFirst) return `PRIMO ${event.type.toUpperCase()}! 🎉`;
    return `${event.type.toUpperCase()}!`;
  };

  const getColor = () => {
    switch(event.type) {
      case "ambo": return "rgba(34,197,94,0.9)";
      case "terno": return "rgba(59,130,246,0.9)";
      case "quaterna": return "rgba(168,85,247,0.9)";
      case "cinquina": return "rgba(239,68,68,0.9)";
      case "tombola": return "rgba(245,158,11,0.9)";
      default: return "rgba(75,107,255,0.9)";
    }
  };

  const getEmoji = () => {
    switch(event.type) {
      case "ambo": return "🎯";
      case "terno": return "⭐";
      case "quaterna": return "🏅";
      case "cinquina": return "👑";
      case "tombola": return "🏆";
      default: return "🎉";
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
        background: `linear-gradient(135deg, ${getColor()}, rgba(255,255,255,0.2))`,
        border: "3px solid rgba(255,255,255,0.5)",
        textAlign: "center",
        animation: "pulse 0.5s infinite alternate"
      }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>{getEmoji()}</div>
        <h2 style={{ color: "#fff", margin: 0, fontSize: 32, textShadow: "0 0 10px rgba(0,0,0,0.5)" }}>
          {getTitle()}
        </h2>
        <div style={{ fontSize: 24, fontWeight: 800, margin: "20px 0", color: "#fff" }}>
          {event.playerName}
        </div>
        <div style={{ 
          fontSize: 20, 
          padding: "10px 20px",
          background: "rgba(255,255,255,0.2)",
          borderRadius: "50px",
          display: "inline-block",
          border: "2px solid rgba(255,255,255,0.5)",
          marginBottom: 20,
          color: "#fff"
        }}>
          Cartella: {event.cardId}
        </div>
        
        {event.isFirst && event.type !== "tombola" && (
          <div style={{ 
            marginTop: 15,
            padding: "8px 16px",
            background: "rgba(255,255,255,0.3)",
            borderRadius: "20px",
            display: "inline-block",
            color: "#fff",
            fontSize: 14
          }}>
            🥇 PRIMO PREMIO {event.type.toUpperCase()}!
          </div>
        )}
        
        <div style={{ marginTop: 30 }}>
          <div className="firework" style={{ left: "20%" }}></div>
          <div className="firework" style={{ left: "40%" }}></div>
          <div className="firework" style={{ left: "60%" }}></div>
          <div className="firework" style={{ left: "80%" }}></div>
        </div>
        
        <div className="small" style={{ marginTop: 20, color: "#fff" }}>
          Clicca per chiudere
        </div>
      </div>
    </div>
  );
}