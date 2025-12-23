import React, { useEffect, useMemo, useState } from "react";
import Board from "../components/Board.jsx";
import LastNumbers from "../components/LastNumbers.jsx";
import CardInput from "../components/CardInput.jsx";
import CartellaView from "../components/CartellaView.jsx";

export default function Player({ socket, onToast }) {
  const [session, setSession] = useState(null);
  const [showBNInfo, setShowBNInfo] = useState(false);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [hostMessage, setHostMessage] = useState(null);
  
  // Stato per disabilitare i popup (caricato da localStorage)
  const [popupsEnabled, setPopupsEnabled] = useState(() => {
    const saved = localStorage.getItem('tombola_popupsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    const onUpdate = (s) => setSession(s);
    socket.on("session:update", onUpdate);
    return () => socket.off("session:update", onUpdate);
  }, [socket]);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    const onHostMessage = (data) => {
      setHostMessage(data);
      setTimeout(() => setHostMessage(null), 10000); // Mostra per 10 secondi
    };
    socket.on("player:message", onHostMessage);
    return () => socket.off("player:message", onHostMessage);
  }, [socket]);

  useEffect(() => {
    // Salva lo stato dei popup in localStorage quando cambia
    localStorage.setItem('tombola_popupsEnabled', JSON.stringify(popupsEnabled));
  }, [popupsEnabled]);

  const togglePopups = () => {
    setPopupsEnabled(prev => !prev);
    onToast?.(popupsEnabled ? "🔕 Popup disabilitati" : "🔔 Popup abilitati");
  };

  // Ascolta i numeri estratti per aggiornare in tempo reale
  useEffect(() => {
    const onNumberDrawn = () => {
      // Refresh della sessione per vedere i numeri aggiornati
      const code = session?.code || localStorage.getItem("tombola_code") || "";
      if (!code) return;
      
      setTimeout(() => {
        socket.emit("session:get", { code }, (res) => {
          if (res?.ok) setSession(res.session);
        });
      }, 500);
    };
    
    socket.on("number:drawn", onNumberDrawn);
    return () => socket.off("number:drawn", onNumberDrawn);
  }, [socket, session?.code]);

  const ensureJoined = () => {
    const code = localStorage.getItem("tombola_code") || "";
    const name = localStorage.getItem("tombola_name") || "Giocatore";
    if (!code) return;

    socket.emit("session:join", { code, name }, (res) => {
      if (!res?.ok) return setErr(res?.error || "Errore join");
      localStorage.setItem("tombola_code", res.session.code);
      localStorage.setItem("tombola_playerId", res.playerId);
      setSession(res.session);
      socket.emit("player:getMe", {}, (meRes) => {
        if (meRes?.ok) setMe(meRes.me);
      });
    });
  };

  useEffect(() => {
    socket.emit("player:getMe", {}, (res) => {
      if (res?.ok) {
        setMe(res.me);
        return;
      }
      ensureJoined();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const copyDrawnNumbers = () => {
    const drawn = session?.state?.drawn || [];
    const text = drawn.join(", ");
    navigator.clipboard.writeText(text).then(() => {
      onToast?.("✅ Numeri copiati negli appunti!");
    });
  };

  const refreshMe = () => {
    socket.emit("player:getMe", {}, (res) => {
      if (res?.ok) setMe(res.me);
    });
  };

  const refreshSession = () => {
    const code = session?.code || localStorage.getItem("tombola_code") || "";
    if (!code) return;
    socket.emit("session:get", { code }, (res) => {
      if (res?.ok) setSession(res.session);
    });
  };

  const resetPlayerSession = () => {
  try {
    const code = localStorage.getItem("tombola_code");
    const playerId = localStorage.getItem("tombola_playerId");
    
    // Invia playerId esplicito
    socket.emit("session:leave", { code, playerId }, () => {});
  } catch {}
  
  localStorage.removeItem("tombola_code");
  localStorage.removeItem("tombola_playerId");
  localStorage.removeItem("tombola_name");
  window.location.hash = "/";
  window.location.reload();
};

  const addCard = (numbers) => {
    socket.emit("player:addCard", { numbers }, (res) => {
      if (!res?.ok) return setErr(res?.error || "Errore aggiunta cartella");
      setErr(null);
      refreshMe();
      refreshSession();
    });
  };

  const addRandomCard = () => {
    socket.emit("player:addRandomCard", {}, (res) => {
      if (!res?.ok) {
        setErr(res?.error || "Errore cartella casuale");
        return;
      }
      setErr(null);
      refreshMe();
      refreshSession();
    });
  };

  const drawn = session?.state?.drawn || [];
  const last5 = session?.state?.last5 || [];

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Giocatore</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="button" onClick={resetPlayerSession}>
          🔄 Resetta sessione
        </button>

        <span className={"badge " + (isConnected ? "pill-green" : "pill-red")}>
          {isConnected ? "🟢 Connesso" : "🔴 Disconnesso"}
        </span>

        <button className="btn" type="button" onClick={refreshSession}>
          🔁 Aggiorna numeri
        </button>

        <button className="btn" type="button" onClick={copyDrawnNumbers}>
          📋 Copia numeri estratti
        </button>
        
        <button 
          className="btn" 
          onClick={togglePopups}
          style={{
            background: popupsEnabled ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
            borderColor: popupsEnabled ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
            color: popupsEnabled ? "#22c55e" : "#ef4444"
          }}
        >
          {popupsEnabled ? "🔔 Disabilita Popup" : "🔕 Abilita Popup"}
        </button>

        <span className="badge pill-gold">
          Sessione: <b style={{ marginLeft: 8 }}>{session?.code || localStorage.getItem("tombola_code") || "?"}</b>
        </span>

        <span className="badge pill-gold">
          Totale punti:{" "}
          <b style={{ marginLeft: 8 }}>
            {session?.stats?.totalBN ?? 0} BN{" "}
            <span title="Info BN" style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => setShowBNInfo(true)}>
              🎅
            </span>
          </b>
        </span>

        <span className="badge pill-gold">
          Le mie cartelle: <b style={{ marginLeft: 8 }}>{me?.cards?.length ?? 0}</b>
        </span>
      </div>

      {hostMessage && (
        <div className="card" style={{ 
          marginTop: 12, 
          borderColor: "rgba(245,158,11,0.7)",
          background: "rgba(245,158,11,0.1)",
          animation: "pulse 2s infinite"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 20 }}>📨</span>
              <strong style={{ marginLeft: 8 }}>Messaggio dal Tomboliere:</strong>
            </div>
            <button 
              className="btn" 
              onClick={() => setHostMessage(null)}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: 8 }}>{hostMessage.message}</div>
          <div className="small" style={{ marginTop: 8 }}>Inviato: {new Date(hostMessage.timestamp).toLocaleTimeString()}</div>
        </div>
      )}

      {err && <div className="card" style={{ marginTop: 12, borderColor: "rgba(255,75,75,0.7)" }}>{err}</div>}

      <div className="row" style={{ marginTop: 12 }}>
        <div className="col card">
          <h3 style={{ marginTop: 0 }}>Ultimi numeri</h3>
          <LastNumbers numbers={last5} />
          <div className="small" style={{ marginTop: 8 }}>
            Estratti totali: <b>{drawn.length}</b>
            {session?.state?.ended ? " · 🏁 Sessione terminata" : ""}
          </div>
        </div>

        <div className="col card">
          <h3 style={{ marginTop: 0 }}>Inserisci cartella</h3>
          <div className="small">Inserisci 3 righe da 5 numeri (1–90, senza duplicati).</div>
          <div style={{ height: 8 }} />
          <CardInput onSubmit={addCard} />

          <button className="btn" style={{ marginTop: 10 }} onClick={addRandomCard}>
            🎲 Aggiungi cartella casuale
          </button>
        </div>
      </div>

      <hr />
      <h3>Le mie cartelle</h3>
      {me?.cards?.length ? (
        <div className="row">
          {me.cards.map((c) => (
            <div className="col card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>Cartella {c.id}</b>
                <span className="small">
                  {["ambo", "terno", "quaterna", "cinquina", "tombola"]
                    .filter((t) => c.wins?.[t])
                    .map((t) => t.toUpperCase())
                    .join(" · ") || "—"}
                </span>
              </div>
              <div style={{ height: 8 }} />
              <CartellaView numbers={c.numbers} drawnSet={new Set(drawn)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="small">Nessuna cartella inserita ancora.</div>
      )}

      <hr />
      <h3>Tabellone</h3>
      <Board drawn={drawn} />

      <hr />
      <button className="btn" onClick={() => (window.location.hash = "/")}>
        ← Home
      </button>

      {showBNInfo && (
        <div className="modal-backdrop" onClick={() => setShowBNInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>🎅 Babbi Natali (BN)</h3>
            <p className="small">
              I BN sono <b>punti fittizi</b> usati solo per il gioco.<br />
              Non rappresentano denaro, credito, premi o valore economico.<br />
              Eventuali accordi tra amici avvengono <b>fuori dall'app</b>.
            </p>
            <button className="btn" onClick={() => setShowBNInfo(false)}>
              Ok
            </button>
          </div>
        </div>
      )}
    </div>
  );
}