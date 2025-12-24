import React, { useEffect, useMemo, useState } from "react";
import Board from "../components/Board.jsx";
import LastNumbers from "../components/LastNumbers.jsx";
import CardInput from "../components/CardInput.jsx";
import CartellaView from "../components/CartellaView.jsx";

export default function Player({ socket, onToast }) {
  // --- STATO ---
  const [session, setSession] = useState(null);
  const [showBNInfo, setShowBNInfo] = useState(false);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [hostMessage, setHostMessage] = useState(null);
  
  // Stato popup
  const [popupsEnabled, setPopupsEnabled] = useState(() => {
    const saved = localStorage.getItem('tombola_popupsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // --- CALCOLO DIRETTO DELLO STATO CARTELLE (Nessun useState!) ---
  // Se session.settings.allowNewCards è undefined, assumiamo TRUE per compatibilità
  // Se è false, è false.
  const cardsAllowed = session?.settings?.allowNewCards ?? true;

  // --- DEBUG LOGS (Guarda la console F12) ---
  console.log("[DEBUG PLAYER] Render. Session:", session);
  console.log("[DEBUG PLAYER] Settings:", session?.settings);
  console.log("[DEBUG PLAYER] cardsAllowed calcolato:", cardsAllowed);

  // --- HELPER PER RICARICARE I DATI ---
  const refreshSession = () => {
    const code = session?.code || localStorage.getItem("tombola_code") || "";
    if (!code) return;
    
    console.log("[DEBUG PLAYER] Richiedo refresh sessione...");
    socket.emit("session:get", { code }, (res) => {
      console.log("[DEBUG PLAYER] Risposta refresh:", res);
      if (res?.ok) setSession(res.session);
    });
  };

  const refreshMe = () => {
    socket.emit("player:getMe", {}, (res) => {
      if (res?.ok) setMe(res.me);
    });
  };

  // --- EFFETTI (Socket Listeners) ---

  // 1. Aggiornamento generico sessione
  useEffect(() => {
    const onUpdate = (s) => {
      console.log("[DEBUG PLAYER] Ricevuto session:update", s);
      setSession(s);
    };
    socket.on("session:update", onUpdate);
    return () => socket.off("session:update", onUpdate);
  }, [socket]);

  // 2. Connessione
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

  // 3. Messaggi dall'host
  useEffect(() => {
    const onHostMessage = (data) => {
      setHostMessage(data);
      setTimeout(() => setHostMessage(null), 10000);
    };
    socket.on("player:message", onHostMessage);
    return () => socket.off("player:message", onHostMessage);
  }, [socket]);

  // 4. CAMBIO STATO CARTELLE (Il punto critico)
  useEffect(() => {
    const onCardsStatusChanged = (data) => {
      console.log("[DEBUG PLAYER] Evento cards:statusChanged ricevuto:", data);
      
      // Mostra toast
      onToast?.(data.message);
      
      // IMPORTANTE: Chiediamo subito al server la sessione aggiornata
      // Questo garantisce che 'session.settings.allowNewCards' si aggiorni
      refreshSession();
    };
    
    socket.on("cards:statusChanged", onCardsStatusChanged);
    return () => socket.off("cards:statusChanged", onCardsStatusChanged);
  }, [socket]);

  // 5. Numeri estratti
  useEffect(() => {
    const onNumberDrawn = () => {
      // Piccolo ritardo per assicurare che il server abbia aggiornato lo stato
      setTimeout(refreshSession, 500);
    };
    socket.on("number:drawn", onNumberDrawn);
    return () => socket.off("number:drawn", onNumberDrawn);
  }, [socket]);

  // 6. Salvataggio preferenze popup
  useEffect(() => {
    localStorage.setItem('tombola_popupsEnabled', JSON.stringify(popupsEnabled));
  }, [popupsEnabled]);

  // --- JOIN INIZIALE ---
  const ensureJoined = () => {
    const code = localStorage.getItem("tombola_code") || "";
    const name = localStorage.getItem("tombola_name") || "Giocatore";
    if (!code) return;

    console.log("[DEBUG PLAYER] Provo a fare Re-Join automatico...");
    socket.emit("session:join", { code, name }, (res) => {
      console.log("[DEBUG PLAYER] Risposta Join:", res);
      if (!res?.ok) return setErr(res?.error || "Errore join");
      
      localStorage.setItem("tombola_code", res.session.code);
      localStorage.setItem("tombola_playerId", res.playerId);
      
      setSession(res.session); // Qui aggiorniamo la sessione iniziale
      
      socket.emit("player:getMe", {}, (meRes) => {
        if (meRes?.ok) setMe(meRes.me);
      });
    });
  };

  // Caricamento iniziale
  useEffect(() => {
    socket.emit("player:getMe", {}, (res) => {
      if (res?.ok) {
        setMe(res.me);
        // Se siamo già connessi, chiediamo comunque la sessione fresca
        const code = localStorage.getItem("tombola_code");
        if(code) socket.emit("session:get", { code }, (r) => r.ok && setSession(r.session));
        return;
      }
      ensureJoined();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);


  // --- FUNZIONI UTENTE ---
  const togglePopups = () => {
    setPopupsEnabled(prev => !prev);
    onToast?.(popupsEnabled ? "🔕 Popup disabilitati" : "🔔 Popup abilitati");
  };

  const copyDrawnNumbers = () => {
    const drawn = session?.state?.drawn || [];
    const text = drawn.join(", ");
    navigator.clipboard.writeText(text).then(() => {
      onToast?.("✅ Numeri copiati negli appunti!");
    });
  };

  const resetPlayerSession = () => {
    try {
      const code = localStorage.getItem("tombola_code");
      const playerId = localStorage.getItem("tombola_playerId");
      socket.emit("session:leave", { code, playerId }, () => {});
    } catch {}
    localStorage.removeItem("tombola_code");
    localStorage.removeItem("tombola_playerId");
    localStorage.removeItem("tombola_name");
    window.location.hash = "/";
    window.location.reload();
  };

  const addCard = (numbers) => {
    if (!cardsAllowed) {
      setErr("L'aggiunta di cartelle è disabilitata dall'host.");
      return;
    }
    socket.emit("player:addCard", { numbers }, (res) => {
      if (!res?.ok) return setErr(res?.error || "Errore aggiunta cartella");
      setErr(null);
      refreshMe();
      refreshSession();
    });
  };

  const addRandomCard = () => {
    if (!cardsAllowed) {
      setErr("L'aggiunta di cartelle è disabilitata dall'host.");
      return;
    }
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

  // --- RENDER ---
  const drawn = session?.state?.drawn || [];
  const last5 = session?.state?.last5 || [];

  if (!session) {
    return <div className="container" style={{textAlign: 'center', marginTop: 50}}>🔄 Caricamento sessione in corso...</div>;
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Giocatore</h2>

      {/* HEADER CONTROLS */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="button" onClick={resetPlayerSession}>🔄 Esci</button>
        
        <span className={"badge " + (isConnected ? "pill-green" : "pill-red")}>
          {isConnected ? "🟢 Online" : "🔴 Offline"}
        </span>

        <button className="btn" type="button" onClick={refreshSession}>🔁 Aggiorna</button>
        <button className="btn" type="button" onClick={copyDrawnNumbers}>📋 Copia Estratti</button>
        
        <button 
          className="btn" 
          onClick={togglePopups}
          style={{
            background: popupsEnabled ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
            borderColor: popupsEnabled ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
            color: popupsEnabled ? "#22c55e" : "#ef4444"
          }}
        >
          {popupsEnabled ? "🔔 Popup ON" : "🔕 Popup OFF"}
        </button>

        <span className="badge pill-gold">Sessione: <b>{session.code}</b></span>
        <span className="badge pill-gold">
          Punti: <b>{session?.stats?.totalBN ?? 0} BN</b>
          <span style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => setShowBNInfo(true)}>🎅</span>
        </span>
      </div>

      {/* MESSAGGI HOST */}
      {hostMessage && (
        <div className="card" style={{ marginTop: 12, borderColor: "#f59e0b", background: "rgba(245,158,11,0.1)", animation: "pulse 2s infinite" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>📨 Messaggio dal Tomboliere:</strong>
            <button className="btn" onClick={() => setHostMessage(null)} style={{ padding: "2px 8px", fontSize: 12 }}>✕</button>
          </div>
          <div style={{ marginTop: 8 }}>{hostMessage.message}</div>
        </div>
      )}

      {err && <div className="card" style={{ marginTop: 12, borderColor: "#ef4444", color: "#ef4444" }}>⚠️ {err}</div>}

      <div className="row" style={{ marginTop: 12 }}>
        {/* ULTIMI NUMERI */}
        <div className="col card">
          <h3 style={{ marginTop: 0 }}>Ultimi numeri</h3>
          <LastNumbers numbers={last5} />
          <div className="small" style={{ marginTop: 8 }}>
            Estratti: <b>{drawn.length}</b> {session?.state?.ended && "🏁 FINITA"}
          </div>
        </div>

        {/* INSERIMENTO CARTELLE (CON LOGICA DI BLOCCO) */}
        <div className="col card">
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Inserisci cartella
            {!cardsAllowed && (
              <span style={{ fontSize: "12px", padding: "3px 8px", background: "#ef4444", borderRadius: "10px", color: "white" }}>
                ⛔ BLOCCATO
              </span>
            )}
          </h3>
          
          {cardsAllowed ? (
            <>
              <div className="small">Inserisci 3 righe da 5 numeri.</div>
              <div style={{ height: 8 }} />
              <CardInput onSubmit={addCard} />
              <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={addRandomCard}>
                🎲 Cartella Casuale
              </button>
            </>
          ) : (
            <div style={{ 
              padding: "20px", 
              textAlign: "center",
              background: "rgba(239,68,68,0.1)",
              borderRadius: "10px",
              border: "1px solid rgba(239,68,68,0.3)",
              marginTop: "10px"
            }}>
              <div style={{ fontSize: "32px", marginBottom: "10px" }}>⛔</div>
              <div style={{ fontWeight: "bold", color: "#ef4444" }}>NUOVE CARTELLE DISABILITATE</div>
              <div className="small" style={{ marginTop: "8px" }}>Il tomboliere ha chiuso le iscrizioni di nuove cartelle.</div>
            </div>
          )}
        </div>
      </div>

      <hr />

      {/* LE MIE CARTELLE */}
      <h3>Le mie cartelle ({me?.cards?.length || 0})</h3>
      {me?.cards?.length ? (
        <div className="row">
          {me.cards.map((c) => (
            <div className="col card" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>Cartella {c.id}</b>
                <span className="small" style={{color: "#4ade80"}}>
                  {["ambo", "terno", "quaterna", "cinquina", "tombola"]
                    .filter((t) => c.wins?.[t]).map((t) => t.toUpperCase()).join(" · ")}
                </span>
              </div>
              <div style={{ height: 8 }} />
              <CartellaView numbers={c.numbers} drawnSet={new Set(drawn)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="small" style={{opacity: 0.6}}>Nessuna cartella inserita.</div>
      )}

      <hr />
      <h3>Tabellone</h3>
      <Board drawn={drawn} />

      <hr />
      <button className="btn" onClick={() => (window.location.hash = "/")}>← Home</button>

      {/* MODAL INFO BN */}
      {showBNInfo && (
        <div className="modal-backdrop" onClick={() => setShowBNInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🎅 Babbi Natali (BN)</h3>
            <p>Punti fittizi per puro divertimento.</p>
            <button className="btn" onClick={() => setShowBNInfo(false)}>Ok</button>
          </div>
        </div>
      )}
    </div>
  );
}