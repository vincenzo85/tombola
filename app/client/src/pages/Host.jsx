import React, { useEffect, useMemo, useState } from "react";
import Board from "../components/Board.jsx";
import LastNumbers from "../components/LastNumbers.jsx";
import CartellaView from "../components/CartellaView.jsx";

const ORDER = ["ambo", "terno", "quaterna", "cinquina", "tombola"];

const DEFAULT_SPLITS = {
  ambo: 15,
  terno: 20,
  quaterna: 20,
  cinquina: 20,
  tombola: 25,
};

function pct(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function rebalanceSplitsLocked(splits, locks, key, nextValue) {
  const cur = { ...splits };
  cur[key] = clamp(pct(nextValue), 0, 100);

  const editable = ORDER.filter((k) => !locks?.[k]);

  if (locks?.[key]) return cur;

  let sum = ORDER.reduce((a, k) => a + pct(cur[k]), 0);
  let diff = sum - 100;

  const startIdx = ORDER.indexOf(key);
  const seq = [...ORDER.slice(startIdx + 1), ...ORDER.slice(0, startIdx)]
    .filter((k) => k !== key && !locks?.[k]);

  if (seq.length === 0) {
    const lockedSum = ORDER.reduce((a, k) => a + (locks?.[k] ? pct(cur[k]) : 0), 0);
    cur[key] = clamp(100 - lockedSum, 0, 100);
    return cur;
  }

  if (diff > 0) {
    let d = diff;
    for (const k of seq) {
      if (d <= 0) break;
      const take = Math.min(d, pct(cur[k]));
      cur[k] = pct(cur[k]) - take;
      d -= take;
    }
    if (d > 0) cur[key] = clamp(pct(cur[key]) - d, 0, 100);
  } else if (diff < 0) {
    let d = -diff;
    for (const k of seq) {
      if (d <= 0) break;
      const room = 100 - pct(cur[k]);
      const add = Math.min(d, room);
      cur[k] = pct(cur[k]) + add;
      d -= add;
    }
    if (d > 0) cur[key] = clamp(pct(cur[key]) + d, 0, 100);
  }

  for (const k of ORDER) cur[k] = Math.round(pct(cur[k]));

  let drift = ORDER.reduce((a, k) => a + pct(cur[k]), 0) - 100;
  if (drift !== 0) {
    const driftKey = !locks?.tombola ? "tombola" : editable.find((k) => k !== key) || key;
    if (driftKey && !locks?.[driftKey]) {
      cur[driftKey] = clamp(pct(cur[driftKey]) - drift, 0, 100);
    }
  }

  return cur;
}

function allocatePrizes(totalBN, splits) {
  const total = Math.max(0, Math.floor(pct(totalBN)));
  const weights = ORDER.map((k) => pct(splits?.[k]));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;

  const raw = weights.map((w) => (total * w) / sumW);
  const base = raw.map((x) => Math.floor(x));
  let used = base.reduce((a, b) => a + b, 0);
  let remaining = total - used;

  const frac = raw.map((x, i) => ({ i, f: x - base[i] }));
  frac.sort((a, b) => b.f - a.f);

  const out = [...base];
  let idx = 0;
  while (remaining > 0 && frac.length) {
    out[frac[idx].i] += 1;
    remaining -= 1;
    idx += 1;
    if (idx >= frac.length) idx = 0;
  }

  const map = {};
  ORDER.forEach((k, i) => (map[k] = out[i]));
  return map;
}

function parseDrawnInput(text) {
  const s = String(text || "").trim();
  if (!s) return [];
  const nums = s
    .split(/[^0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 90);
  const seen = new Set();
  const out = [];
  for (const n of nums) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// ✅ COMPONENTE EVENT LOG
function EventLog({ events = [] }) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all');
  
  const filtered = events.filter(e => {
    if (filter === 'all') return true;
    return e.type === filter;
  });

  const getEventColor = (type) => {
    switch(type) {
      case 'draw': return '#3b82f6';
      case 'win': return '#22c55e';
      case 'settings': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'card_added': return '#8b5cf6';
      case 'import': return '#ec4899';
      case 'game_end': return '#10b981';
      case 'session_created': return '#06b6d4';
      case 'player_joined': return '#14b8a6';
      case 'card_deleted': return '#f97316';
      default: return '#6b7280';
    }
  };

  const getEventIcon = (type) => {
    switch(type) {
      case 'draw': return '🎲';
      case 'win': return '🏆';
      case 'settings': return '⚙️';
      case 'error': return '❌';
      case 'card_added': return '🎴';
      case 'import': return '📥';
      case 'game_end': return '🏁';
      case 'session_created': return '🎯';
      case 'player_joined': return '👋';
      case 'card_deleted': return '🗑️';
      case 'reset': return '🔄';
      case 'message': return '💬';
      default: return '📋';
    }
  };

  return (
    <div className="card" style={{ maxHeight: expanded ? '500px' : '60px', transition: 'max-height 0.3s', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? 10 : 0 }}>
        <h3 style={{ margin: 0 }}>📊 Log Eventi ({events.length})</h3>
        <button 
          className="btn" 
          onClick={() => setExpanded(!expanded)}
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          {expanded ? '▼ Riduci' : '▶ Espandi'}
        </button>
      </div>

      {expanded && (
        <>
          <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
            {['all', 'draw', 'win', 'card_added', 'settings', 'error'].map(f => (
              <button
                key={f}
                className="btn"
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  background: filter === f ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
                  borderColor: filter === f ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.1)'
                }}
              >
                {f === 'all' ? '🔄 Tutti' : `${getEventIcon(f)} ${f.replace('_', ' ')}`}
              </button>
            ))}
          </div>

          <div style={{ 
            maxHeight: '350px', 
            overflowY: 'auto', 
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            padding: '10px'
          }}>
            {filtered.length === 0 ? (
              <div className="small" style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>
                Nessun evento da mostrare
              </div>
            ) : (
              filtered.map((event, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '8px',
                    marginBottom: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    borderLeft: `3px solid ${getEventColor(event.type)}`,
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ marginRight: 6 }}>{getEventIcon(event.type)}</span>
                      <span style={{ fontWeight: 'bold', color: getEventColor(event.type) }}>
                        {event.type.toUpperCase()}
                      </span>
                      <span style={{ marginLeft: 8 }}>{event.message}</span>
                    </div>
                    <span className="small" style={{ opacity: 0.5, whiteSpace: 'nowrap', marginLeft: 10 }}>
                      {new Date(event.timestamp).toLocaleTimeString('it-IT')}
                    </span>
                  </div>
                  {event.data && Object.keys(event.data).length > 0 && (
                    <details style={{ marginTop: 4, marginLeft: 20 }}>
                      <summary className="small" style={{ cursor: 'pointer', opacity: 0.7 }}>
                        Dettagli
                      </summary>
                      <pre className="small" style={{ 
                        background: 'rgba(0,0,0,0.3)', 
                        padding: '6px', 
                        borderRadius: '4px',
                        marginTop: '4px',
                        overflow: 'auto',
                        maxHeight: '100px'
                      }}>
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Host({ socket, onToast }) {
  // Stati
  const [hostName, setHostName] = useState("Tomboliere");
  const [newCardsAllowed, setNewCardsAllowed] = useState(false);
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [hostView, setHostView] = useState(null);
  const [showBNInfo, setShowBNInfo] = useState(false);
  const [bnPerCard, setBnPerCard] = useState(2);
  const [splits, setSplits] = useState(DEFAULT_SPLITS); 
  const [liveSplits, setLiveSplits] = useState(DEFAULT_SPLITS);
  const [locks, setLocks] = useState({
    ambo: false, terno: false, quaterna: false, cinquina: false, tombola: false,
  });
  const [importText, setImportText] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [playerMessage, setPlayerMessage] = useState("");
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [parsedNumbers, setParsedNumbers] = useState([]);
  const [importError, setImportError] = useState("");
  const [manualNumber, setManualNumber] = useState("");

  // Socket listeners
  useEffect(() => {
    const onUpdate = (s) => setSession(s);
    socket.on("session:update", onUpdate);
    return () => socket.off("session:update", onUpdate);
  }, [socket]);

  useEffect(() => {
    const onHostUpdate = (s) => setHostView(s);
    socket.on("host:update", onHostUpdate);
    return () => socket.off("host:update", onHostUpdate);
  }, [socket]);

  useEffect(() => {
    if (session?.settings?.allowNewCards !== undefined) {
      setNewCardsAllowed(session.settings.allowNewCards);
    }
    if (session?.settings?.splits) {
      setLiveSplits(session.settings.splits);
    }
  }, [session?.settings]);

  // Funzioni
  const saveSplitsToServer = (nextSplits) => {
    socket.emit("host:updateSettings", { settings: { splits: nextSplits } }, (res) => {
      if (!res?.ok) onToast?.(res?.error || "Errore salvataggio ripartizione");
    });
  };

  const toggleNewCards = (allow) => {
    const newStatus = allow !== undefined ? allow : !newCardsAllowed;
    socket.emit("host:toggleNewCards", { allowNewCards: newStatus }, (res) => {
      if (!res?.ok) return onToast?.(res?.error || "Errore cambio stato cartelle");
      setNewCardsAllowed(res.allowNewCards);
      onToast?.(res.allowNewCards ? "✅ Nuove cartelle ora abilitate" : "⛔ Nuove cartelle ora disabilitate");
    });
  };

  const create = () => {
    socket.emit("host:create", { 
      hostName, 
      settings: { bnPerCard, splits, allowNewCards: false } 
    }, (res) => {
      if (!res?.ok) return onToast?.(res?.error || "Errore creazione sessione");
      setCode(res.code);
      setSession(res.session);
      onToast?.(`Sessione creata: codice ${res.code}`);
    });
  };

  const draw = () => {
    socket.emit("host:draw", {}, (res) => {
      if (!res?.ok) return onToast?.(res?.error || "Errore estrazione");
      if (res.done) return onToast?.("Numeri finiti, sessione terminata.");
      onToast?.(`Numero estratto: ${res.number}`);
      if (res.ended) onToast?.("🏁 Tombola! Sessione chiusa.");
    });
  };

  const drawManual = () => {
    const num = parseInt(manualNumber);
    socket.emit("host:drawSpecific", { number: num }, (res) => {
      if (!res?.ok) {
        onToast?.(res?.error || "Errore estrazione");
      } else {
        onToast?.(`✅ Numero ${num} estratto manualmente!`);
        setManualNumber("");
      }
    });
  };

  const copyDrawnNumbers = () => {
    const drawnList = session?.state?.drawn ?? session?.drawn ?? [];
    navigator.clipboard.writeText(drawnList.join(", ")).then(() => {
      onToast?.("✅ Numeri copiati negli appunti!");
    });
  };

  const sendPlayerMessage = () => {
    if (!selectedPlayer || !playerMessage.trim()) {
      return onToast?.("Seleziona un giocatore e scrivi un messaggio");
    }
    socket.emit("host:sendMessage", { playerId: selectedPlayer, message: playerMessage.trim() }, (res) => {
      if (res?.ok) {
        onToast?.("✅ Messaggio inviato!");
        setPlayerMessage("");
        setShowMessageModal(false);
      } else {
        onToast?.(res?.error || "Errore invio messaggio");
      }
    });
  };

  const handleImportClick = () => {
    const numbers = parseDrawnInput(importText);
    const invalidNumbers = numbers.filter(n => n < 1 || n > 90);
    if (invalidNumbers.length > 0) {
      return setImportError(`Numeri non validi: ${invalidNumbers.join(", ")}. I numeri devono essere tra 1 e 90.`);
    }
    setParsedNumbers(numbers);
    setImportError("");
    setShowImportConfirm(true);
  };

  const confirmImport = () => {
    socket.emit("host:setDrawn", { numbers: parsedNumbers }, (res) => {
      if (!res?.ok) {
        onToast?.(res?.error || "Errore import");
      } else {
        onToast?.("✅ Numeri estratti importati con successo!");
        setImportText("");
        setImportError("");
      }
      setShowImportConfirm(false);
    });
  };

  const resetGame = () => {
    socket.emit("host:setDrawn", { numbers: [] }, (res) => {
      if (!res?.ok) {
        onToast?.(res?.error || "Errore reset partita");
      } else {
        onToast?.("✅ Partita resettata!");
      }
      setShowResetConfirm(false);
    });
  };

  const resetPartial = () => {
    socket.emit("host:resetPartial", {}, (res) => {
      if (!res?.ok) {
        onToast?.(res?.error || "Errore reset parziale");
      } else {
        onToast?.("✅ Partita resettata! Le cartelle sono state mantenute.");
      }
      setShowResetConfirm(false);
    });
  };

  const deletePlayerCard = (playerId, cardId) => {
    if (!confirm("Eliminare questa cartella?")) return;
    socket.emit("host:deleteCard", { playerId, cardId }, (res) => {
      if (!res?.ok) {
        onToast?.(res?.error || "Errore eliminazione cartella");
      } else {
        onToast?.("✅ Cartella eliminata!");
      }
    });
  };

  // Calcoli UI
  const joinUrl = useMemo(() => {
    const c = session?.code || code;
    return c ? `${window.location.origin}/#/join?code=${c}` : "";
  }, [session?.code, code]);

  const qrImgSrc = useMemo(() => {
    return joinUrl ? `/api/qr?text=${encodeURIComponent(joinUrl)}` : "";
  }, [joinUrl]);

  const totalCardsFromPlayers = (session?.players || []).reduce((a, p) => a + (p.cardsCount || 0), 0);
  const totalCards = session?.stats?.totalCards ?? totalCardsFromPlayers ?? 0;
  const bnEach = session?.settings?.bnPerCard ?? bnPerCard;
  const totalBN = session?.stats?.totalBN ?? totalCards * bnEach;
  const effectiveSplits = code ? (session?.settings?.splits ?? liveSplits) : splits;
  const prizes = useMemo(() => allocatePrizes(totalBN, effectiveSplits), [totalBN, effectiveSplits]);
  const drawnList = session?.state?.drawn ?? session?.drawn ?? [];
  const last5 = session?.state?.last5 ?? session?.lastNumbers ?? drawnList.slice(-5);
  const isImportDisabled = !importText.trim();

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Tomboliere</h2>

      {/* Creazione sessione */}
      {!code && (
        <>
          <div className="row">
            <div className="col">
              <label className="small">Nome</label>
              <input className="input" value={hostName} onChange={(e) => setHostName(e.target.value)} />
            </div>

            <div className="col">
              <label className="small">Gettoni per cartella (🎅 BN): <b>{bnPerCard}</b></label>
              <input className="input" type="range" min="0" max="10" step="0.5" value={bnPerCard}
                onChange={(e) => setBnPerCard(Number(e.target.value))} style={{ width: "100%" }} />
              <div className="small" style={{ marginTop: 6 }}>
                <span title="Info BN" style={{ cursor: "pointer" }} onClick={() => setShowBNInfo(true)}>
                  ℹ️ Cos'è BN?
                </span>
              </div>
            </div>

            <div className="col card">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Ripartizione premi (iniziale)</div>
              {ORDER.map((k) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ textTransform: "capitalize" }}>{k}</div>
                    <div className="small"><b>{splits[k]}%</b></div>
                  </div>
                  <input type="range" min="0" max="100" value={splits[k]}
                    onChange={(e) => setSplits((s) => rebalanceSplitsLocked(s, {}, k, e.target.value))}
                    style={{ width: "100%" }} />
                </div>
              ))}
              <div className="small">Somma: <b>{ORDER.reduce((a, k) => a + pct(splits[k]), 0)}%</b></div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={create}>Crea sessione</button>
        </>
      )}

      {/* Partita live */}
      {code && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <span className="badge pill-gold">Codice: <b style={{marginLeft:6}}>{code}</b></span>
            <span className="badge pill-gold">Cartelle: <b style={{marginLeft:6}}>{totalCards}</b></span>
            <span className="badge pill-gold">
              Montepremi: <b style={{marginLeft:6}}>{Math.floor(totalBN)} BN</b>
              <span title="Info BN" style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => setShowBNInfo(true)}>ℹ️</span>
            </span>
            <span className={"badge " + (newCardsAllowed ? "pill-green" : "pill-red")}>
              {newCardsAllowed ? "ISCRIZIONI APERTE" : "ISCRIZIONI CHIUSE"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={draw} disabled={session?.state?.ended}>
              🎲 Estrai Casuale
            </button>
            
            <div style={{ display: "flex", gap: 5 }}>
              <input
                className="input"
                type="number"
                min="1"
                max="90"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="1-90"
                style={{ width: "80px" }}
              />
              <button 
                className="btn" 
                onClick={drawManual}
                disabled={!manualNumber || session?.state?.ended}
              >
                ✍️ Estrai Manuale
              </button>
            </div>

            <button 
              className="btn" 
              onClick={resetPartial}
              style={{ background: "rgba(245,158,11,0.2)", borderColor: "rgba(245,158,11,0.5)" }}
            >
              🔄 Reset Parziale
            </button>

            <button className="btn" onClick={() => toggleNewCards()} style={{
                background: newCardsAllowed ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)",
                color: newCardsAllowed ? "#ef4444" : "#22c55e",
                borderColor: newCardsAllowed ? "#ef4444" : "#22c55e"
              }}>
              {newCardsAllowed ? "⛔ Chiudi Iscrizioni" : "✅ Apri Iscrizioni"}
            </button>
            <button className="btn" onClick={copyDrawnNumbers}>📋 Copia Estratti</button>
            <button className="btn" onClick={() => setShowMessageModal(true)}>💬 Invia Messaggio</button>
            <button 
              className="btn" 
              onClick={() => setShowResetConfirm(true)}
              style={{
                background: "rgba(239,68,68,0.2)",
                color: "#ef4444",
                borderColor: "#ef4444"
              }}
            >
              🔄 Reset Totale
            </button>
          </div>

          {/* ✅ LOG EVENTI - POSIZIONATO SUBITO DOPO I CONTROLLI */}
          <div style={{ marginTop: 12 }}>
            <EventLog events={hostView?.eventLog || []} />
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Estrazione</h3>
              <div style={{ marginTop: 12 }}><LastNumbers numbers={last5 || []} /></div>
              <div style={{ marginTop: 12 }}><Board drawn={drawnList || []} /></div>
              <div style={{ marginTop: 12 }} className="card">
                <h4 style={{ marginTop: 0 }}>Ordine estrazione</h4>
                {drawnList?.length ? (
                  <>
                    <div className="small" style={{ opacity: 0.9, marginBottom: 8 }}>
                      Totale estratti: <b>{drawnList.length}</b>
                    </div>
                    <div className="small" style={{ wordBreak: "break-word", lineHeight: 1.6 }}>
                      {drawnList.map((n, i) => (
                        <span key={i}>
                          <b>{n}</b>
                          {i < drawnList.length - 1 ? " → " : ""}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="small">(ancora nessuna estrazione)</div>
                )}
              </div>
            </div>

            <div className="col card">
              <h3 style={{ marginTop: 0 }}>QR Code</h3>
              <div className="small">Scansiona con la fotocamera</div>
              <div style={{ background: "white", padding: 10, borderRadius: 12, margin: "10px auto", width: "fit-content" }}>
                {qrImgSrc && <img src={qrImgSrc} alt="QR" style={{ width: 180, height: 180 }} />}
              </div>
              <div className="small" style={{textAlign: "center"}}>Codice: <b>{session?.code}</b></div>
              <hr />
              <div className="small" style={{ wordBreak: "break-all", opacity: 0.9 }}>{joinUrl}</div>
            </div>

            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Gestione Premi Live</h3>
              <div className="small" style={{ marginBottom: 10 }}>Montepremi: <b>{Math.floor(totalBN)} BN</b></div>
              
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
                {ORDER.map((k) => (
                  <div key={k} style={{ marginBottom: 12, opacity: locks[k] ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ textTransform: "capitalize", width: 70 }}>{k}</div>
                        <div style={{ fontWeight: "bold", color: "#f59e0b" }}>{prizes[k]} BN</div>
                      </div>
                      <label className="small" style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }}>
                        <input type="checkbox" checked={!!locks[k]} onChange={(e) => setLocks((l) => ({ ...l, [k]: e.target.checked }))} />
                        🔒 Blocca
                      </label>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="range" min="0" max="100" value={pct(effectiveSplits?.[k])} disabled={!!locks[k]}
                        onChange={(e) => {
                          const next = rebalanceSplitsLocked(effectiveSplits, locks, k, e.target.value);
                          setLiveSplits(next);
                          saveSplitsToServer(next);
                        }} style={{ flex: 1 }} />
                      <div className="small" style={{ width: 40, textAlign: "right" }}>{pct(effectiveSplits?.[k])}%</div>
                    </div>
                  </div>
                ))}
                <div className="small" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Totale: {ORDER.reduce((a, k) => a + pct(effectiveSplits?.[k]), 0)}%
                </div>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Importa Partita</h3>
              <div className="small">
                Incolla i numeri estratti (es: <b>1,2,3,10,90</b> o con spazi). Numeri da 1 a 90. Lascia vuoto per azzerare.
              </div>
              <textarea 
                className="input" 
                style={{ minHeight: 80, marginTop: 8 }} 
                value={importText} 
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError("");
                }} 
                placeholder="Es: 5 12 33 45 90 (o lascia vuoto per azzerare)" 
              />
              {importError && (
                <div style={{ 
                  marginTop: 8, 
                  padding: "8px 12px", 
                  background: "rgba(239,68,68,0.1)", 
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "8px",
                  color: "#ef4444",
                  fontSize: "14px"
                }}>
                  ⚠️ {importError}
                </div>
              )}
              <button 
                className="btn btn-primary" 
                style={{ marginTop: 10 }} 
                onClick={handleImportClick}
              >
                ✅ Imposta estratti
              </button>
              {!isImportDisabled && (
                <div className="small" style={{ marginTop: 8, color: "rgba(255,255,255,0.7)" }}>
                  {parseDrawnInput(importText).length > 0 
                    ? `Verrà importato: ${parseDrawnInput(importText).join(", ")}`
                    : "Verrà azzerata la partita (0 numeri)"}
                </div>
              )}
            </div>

            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Giocatori ({totalCardsFromPlayers} cartelle)</h3>
              {session?.players?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {session.players.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>🎄 {p.name}</div>
                      <b>{p.cardsCount}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">Nessun giocatore connesso.</div>
              )}
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Cartelle Live (Solo Host)</h3>
              {hostView?.playersFull?.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {hostView.playersFull.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b>👤 {p.name}</b>
                        <span className="small">Cartelle: <b>{p.cards?.length || 0}</b></span>
                      </div>
                      <div style={{ height: 8 }} />
                      {p.cards?.length ? (
                        <div className="row">
                          {p.cards.map((c) => (
                            <div className="col card" key={c.id} style={{ position: "relative" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <b>{c.id}</b>
                                <span className="small">
                                  {["ambo", "terno", "quaterna", "cinquina", "tombola"]
                                    .filter((t) => c.wins?.[t])
                                    .map((t) => t.toUpperCase())
                                    .join(" · ") || "—"}
                                </span>
                              </div>
                              <div style={{ height: 8 }} />
                              <CartellaView 
                                numbers={c.numbers} 
                                drawnSet={new Set(drawnList || [])}
                                manuallyMarked={c.manuallyMarked ? new Set(c.manuallyMarked) : new Set()}
                                onDelete={() => deletePlayerCard(p.id, c.id)}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="small">Nessuna cartella.</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">Nessun dato cartelle ancora.</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showMessageModal && (
        <div className="modal-backdrop" onClick={() => setShowMessageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{marginTop:0}}>💬 Invia Messaggio</h3>
            <select className="input" value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={{ marginBottom: 10, width: "100%" }}>
              <option value="">-- Seleziona --</option>
              {hostView?.playersFull?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <textarea className="input" value={playerMessage} onChange={(e) => setPlayerMessage(e.target.value)} style={{ width: "100%", height: 80 }} placeholder="Messaggio..." />
            <div style={{marginTop:10, display:"flex", gap:10}}>
              <button className="btn btn-primary" onClick={sendPlayerMessage} disabled={!selectedPlayer || !playerMessage.trim()}>Invia</button>
              <button className="btn" onClick={() => setShowMessageModal(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {showImportConfirm && (
        <div className="modal-backdrop" onClick={() => setShowImportConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{marginTop:0}}>⚠️ Conferma Importazione</h3>
            <p>
              {parsedNumbers.length > 0 
                ? `Stai per importare ${parsedNumbers.length} numeri:`
                : "Stai per resettare tutti i numeri estratti (0 numeri)"}
            </p>
            {parsedNumbers.length > 0 && (
              <div style={{ 
                background: "rgba(0,0,0,0.2)", 
                padding: "12px", 
                borderRadius: "8px",
                margin: "12px 0",
                maxHeight: "200px",
                overflowY: "auto"
              }}>
                <b>{parsedNumbers.join(", ")}</b>
              </div>
            )}
            
            <div style={{ 
              background: "rgba(239,68,68,0.1)", 
              padding: "12px", 
              borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.3)",
              margin: "12px 0"
            }}>
              <h4 style={{ color: "#ef4444", marginTop: 0 }}>⚠️ ATTENZIONE!</h4>
              <p className="small" style={{ color: "#ef4444" }}>
                Questa operazione <b>cancellerà tutti i dati attuali</b>
              </p>
            </div>
            
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowImportConfirm(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={confirmImport} style={{background:"#ef4444", borderColor:"#ef4444"}}>Conferma Reset</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{marginTop:0}}>🔄 Reset Partita</h3>
            <div style={{ 
              background: "rgba(239,68,68,0.1)", 
              padding: "12px", 
              borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.3)",
              margin: "12px 0"
            }}>
              <p style={{ color: "#ef4444", marginTop: 0 }}>
                <b>⚠️ ATTENZIONE!</b>
              </p>
              <p className="small" style={{ color: "#ef4444" }}>
                Reset completo della partita (numeri + vincite)
              </p>
            </div>
            
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 15 }}>
              <button className="btn" onClick={() => setShowResetConfirm(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={resetGame} 
                style={{background:"#ef4444", borderColor:"#ef4444"}}>
                Conferma Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {showBNInfo && (
        <div className="modal-backdrop" onClick={() => setShowBNInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>🎅 Babbi Natali (BN)</h3>
            <p className="small">
              I <b>Babbi Natali (BN)</b> sono un'unità di punteggio virtuale per gestire i premi in modo ludico tra amici e famiglia. Non rappresentano denaro reale.
            </p>
            <button className="btn" onClick={() => setShowBNInfo(false)}>Ok</button>
          </div>
        </div>
      )}
    </div>
  );
}
