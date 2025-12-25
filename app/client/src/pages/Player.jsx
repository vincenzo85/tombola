import React, { useEffect, useMemo, useState, useRef } from "react";
import Board from "../components/Board.jsx";
import LastNumbers from "../components/LastNumbers.jsx";
import CardInput from "../components/CardInput.jsx";
import CartellaView from "../components/CartellaView.jsx";
import Tesseract from 'tesseract.js';

export default function Player({ socket, onToast }) {
  // Stati
  const [session, setSession] = useState(null);
  const [showBNInfo, setShowBNInfo] = useState(false);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [hostMessage, setHostMessage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const workerRef = useRef(null);
  const [ocrDebug, setOcrDebug] = useState(null);
  
  const [popupsEnabled, setPopupsEnabled] = useState(() => {
    const saved = localStorage.getItem('tombola_popupsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const cardsAllowed = session?.settings?.allowNewCards ?? true;

  console.log("[DEBUG PLAYER] Render. Session:", session);
  console.log("[DEBUG PLAYER] Settings:", session?.settings);
  console.log("[DEBUG PLAYER] cardsAllowed calcolato:", cardsAllowed);

  // Inizializza worker OCR
  useEffect(() => {
    const initWorker = async () => {
      try {
        console.log("[OCR DEBUG] Inizializzazione worker OCR...");
        workerRef.current = await Tesseract.createWorker('eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/worker.min.js',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',
        });
        console.log("[OCR DEBUG] Worker OCR inizializzato con successo!");
      } catch (e) {
        console.error("[OCR DEBUG] Errore init worker:", e);
      }
    };

    initWorker();

    return () => {
      if (workerRef.current) {
        console.log("[OCR DEBUG] Terminazione worker...");
        workerRef.current.terminate();
      }
    };
  }, []);

  const handleOCR = async (file) => {
    console.log("[OCR DEBUG] handleOCR chiamato con file:", file);
    
    if (!workerRef.current) {
      console.error("[OCR DEBUG] Worker non inizializzato!");
      return onToast?.("❌ OCR non inizializzato. Ricarica la pagina.");
    }

    setOcrLoading(true);
    setOcrDebug({ step: "Lettura immagine in corso..." });
    
    try {
      console.log("[OCR DEBUG] Inizio riconoscimento...");
      const { data: { text, confidence } } = await workerRef.current.recognize(file);
      
      console.log("[OCR DEBUG] Testo riconosciuto:", text);
      console.log("[OCR DEBUG] Confidenza:", confidence);
      
      setOcrDebug({ 
        step: "Testo riconosciuto", 
        text, 
        confidence: Math.round(confidence) + '%' 
      });
      
      const allNumbers = text.match(/\d+/g);
      console.log("[OCR DEBUG] Numeri trovati (raw):", allNumbers);
      
      const numbers = allNumbers
        ?.map(n => parseInt(n))
        .filter(n => n >= 1 && n <= 90)
        .slice(0, 15) || [];
      
      console.log("[OCR DEBUG] Numeri validi (1-90):", numbers);
      console.log("[OCR DEBUG] Numero di numeri validi:", numbers.length);
      
      setOcrDebug({ 
        step: `Trovati ${numbers.length}/15 numeri`, 
        numbers: numbers.join(', '),
        text 
      });
      
      if (numbers.length === 15) {
        const rows = [
          numbers.slice(0, 5),
          numbers.slice(5, 10),
          numbers.slice(10, 15)
        ];
        console.log("[OCR DEBUG] Invio cartella al server:", rows);
        
        socket.emit("player:addCard", { numbers: rows }, (res) => {
          console.log("[OCR DEBUG] Risposta server:", res);
          if (res?.ok) {
            onToast?.("✅ Cartella caricata da foto!");
            setOcrDebug(null);
          } else {
            onToast?.(res?.error || "Errore aggiunta cartella");
          }
        });
      } else {
        const msg = `⚠️ Trovati ${numbers.length}/15 numeri validi (${numbers.join(', ') || 'nessuno'}). Riprova con foto più chiara o inserisci manualmente.`;
        console.warn("[OCR DEBUG]", msg);
        onToast?.(msg);
      }
    } catch (e) {
      console.error("[OCR DEBUG] Errore durante OCR:", e);
      setOcrDebug({ step: "Errore", error: e.message });
      onToast?.("❌ Errore OCR: " + e.message);
    }
    
    setOcrLoading(false);
    
    // Auto-chiudi debug dopo 10 secondi
    setTimeout(() => setOcrDebug(null), 10000);
  };

  const deleteCard = (cardId) => {
    if (!confirm("Eliminare questa cartella?")) return;
    socket.emit("player:deleteCard", { cardId }, (res) => {
      if (!res?.ok) {
        onToast?.(res?.error || "Errore eliminazione");
      } else {
        onToast?.("✅ Cartella eliminata!");
      }
    });
  };

  const toggleNumber = (cardId, number) => {
    if (!manualMode) return;
    socket.emit("player:markNumber", { cardId, number }, (res) => {
      if (!res?.ok) onToast?.(res?.error || "Errore");
    });
  };

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

  // Effetti socket
  useEffect(() => {
    const onUpdate = (s) => {
      console.log("[DEBUG PLAYER] Ricevuto session:update", s);
      setSession(s);
    };
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
      setTimeout(() => setHostMessage(null), 10000);
    };
    socket.on("player:message", onHostMessage);
    return () => socket.off("player:message", onHostMessage);
  }, [socket]);

  useEffect(() => {
    const onCardsStatusChanged = (data) => {
      console.log("[DEBUG PLAYER] Evento cards:statusChanged ricevuto:", data);
      onToast?.(data.message);
      refreshSession();
    };
    
    socket.on("cards:statusChanged", onCardsStatusChanged);
    return () => socket.off("cards:statusChanged", onCardsStatusChanged);
  }, [socket]);

  useEffect(() => {
    const onNumberDrawn = () => {
      setTimeout(refreshSession, 500);
    };
    socket.on("number:drawn", onNumberDrawn);
    return () => socket.off("number:drawn", onNumberDrawn);
  }, [socket]);

  useEffect(() => {
    localStorage.setItem('tombola_popupsEnabled', JSON.stringify(popupsEnabled));
  }, [popupsEnabled]);

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
        const code = localStorage.getItem("tombola_code");
        if(code) socket.emit("session:get", { code }, (r) => r.ok && setSession(r.session));
        return;
      }
      ensureJoined();
    });
  }, [socket]);

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
          onClick={() => setManualMode(!manualMode)}
          style={{
            background: manualMode ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
            borderColor: manualMode ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.14)"
          }}
        >
          {manualMode ? "✅ Modalità Manuale" : "🤖 Modalità Automatica"}
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
          {popupsEnabled ? "🔔 Popup ON" : "🔕 Popup OFF"}
        </button>

        <span className="badge pill-gold">Sessione: <b>{session.code}</b></span>
        <span className="badge pill-gold">
          Punti: <b>{session?.stats?.totalBN ?? 0} BN</b>
          <span style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => setShowBNInfo(true)}>🎅</span>
        </span>
      </div>

      {/* BOTTONE FOTO OCR */}
      <div style={{ marginTop: 12 }}>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          onChange={(e) => {
            console.log("[OCR DEBUG] File selezionato:", e.target.files[0]);
            if (e.target.files[0]) {
              handleOCR(e.target.files[0]);
            }
          }}
          style={{ display: "none" }}
          id="ocr-input"
        />
        <label 
          htmlFor="ocr-input" 
          className="btn btn-primary" 
          style={{ 
            width: "100%",
            cursor: ocrLoading ? "wait" : "pointer",
            opacity: ocrLoading ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "16px",
            padding: "12px"
          }}
        >
          {ocrLoading ? (
            <>
              <span className="spinner" style={{ 
                width: "16px", 
                height: "16px", 
                border: "2px solid rgba(255,255,255,0.3)",
                borderTop: "2px solid white",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }}></span>
              Scansione in corso...
            </>
          ) : (
            <>
              📷 Carica cartella da foto
            </>
          )}
        </label>
      </div>

      {/* DEBUG OCR */}
      {ocrDebug && (
        <div className="card" style={{ 
          marginTop: 12, 
          background: "rgba(59,130,246,0.1)", 
          borderColor: "rgba(59,130,246,0.5)",
          fontSize: "14px"
        }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>🔍 Debug OCR</div>
          <div><b>Step:</b> {ocrDebug.step}</div>
          {ocrDebug.confidence && <div><b>Confidenza:</b> {ocrDebug.confidence}</div>}
          {ocrDebug.numbers && <div><b>Numeri trovati:</b> {ocrDebug.numbers}</div>}
          {ocrDebug.text && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>Mostra testo completo</summary>
              <pre style={{ 
                background: "rgba(0,0,0,0.3)", 
                padding: "8px", 
                borderRadius: "4px",
                fontSize: "12px",
                marginTop: "8px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>{ocrDebug.text}</pre>
            </details>
          )}
          {ocrDebug.error && <div style={{ color: "#ef4444" }}><b>Errore:</b> {ocrDebug.error}</div>}
        </div>
      )}

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

        {/* INSERIMENTO CARTELLE */}
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
            <div className="col card" key={c.id} style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>Cartella {c.id}</b>
                <span className="small" style={{color: "#4ade80"}}>
                  {["ambo", "terno", "quaterna", "cinquina", "tombola"]
                    .filter((t) => c.wins?.[t]).map((t) => t.toUpperCase()).join(" · ")}
                </span>
              </div>
              <div style={{ height: 8 }} />
              <CartellaView 
                numbers={c.numbers} 
                drawnSet={new Set(drawn)}
                manuallyMarked={c.manuallyMarked ? new Set(c.manuallyMarked) : new Set()}
                manualMode={manualMode}
                onNumberClick={(num) => toggleNumber(c.id, num)}
                onDelete={() => deleteCard(c.id)}
              />
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
