import React, { useEffect, useMemo, useState } from "react";
import Board from "../components/Board.jsx";
import LastNumbers from "../components/LastNumbers.jsx";
import CartellaView from "../components/CartellaView.jsx";

const ORDER = ["ambo", "terno", "quaterna", "cinquina", "tombola"];

function pct(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function rebalanceSplits(splits, key, nextValue) {
  const cur = { ...splits };
  cur[key] = clamp(pct(nextValue), 0, 100);

  let sum = ORDER.reduce((a, k) => a + pct(cur[k]), 0);
  let diff = sum - 100;

  const startIdx = ORDER.indexOf(key);
  const seq = [...ORDER.slice(startIdx + 1), ...ORDER.slice(0, startIdx)];

  if (diff > 0) {
    let d = diff;
    for (const k of seq) {
      if (k === key) continue;
      if (d <= 0) break;
      const take = Math.min(d, pct(cur[k]));
      cur[k] = pct(cur[k]) - take;
      d -= take;
    }
    if (d > 0) cur[key] = clamp(pct(cur[key]) - d, 0, 100);
  } else if (diff < 0) {
    let d = -diff;
    for (const k of seq) {
      if (k === key) continue;
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
  if (drift !== 0) cur["tombola"] = clamp(pct(cur["tombola"]) - drift, 0, 100);

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

export default function Host({ socket, onToast }) {
  const [hostName, setHostName] = useState("Tomboliere");
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [hostView, setHostView] = useState(null);

  const [showBNInfo, setShowBNInfo] = useState(false);
  const [bnPerCard, setBnPerCard] = useState(2);
  const [splits, setSplits] = useState({
    ambo: 15,
    terno: 20,
    quaterna: 20,
    cinquina: 20,
    tombola: 25,
  });

  const [importText, setImportText] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [playerMessage, setPlayerMessage] = useState("");
  const [showMessageModal, setShowMessageModal] = useState(false);

  const joinUrl = useMemo(() => {
    const c = session?.code || code;
    return c ? `${window.location.origin}/#/join?code=${c}` : "";
  }, [session?.code, code]);

  const qrImgSrc = useMemo(() => {
    if (!joinUrl) return "";
    return `/api/qr?text=${encodeURIComponent(joinUrl)}`;
  }, [joinUrl]);

  useEffect(() => {
    const onUpdate = (s) => setSession(s);
    socket.on("session:update", onUpdate);
    return () => socket.off("session:update", onUpdate);
  }, [socket]);

  useEffect(() => {
    const onHostUpdate = (s) => setHostView(s);
    socket.on("host:update", onHostUpdate);
    return () => socket.off("host:update", onHostView);
  }, [socket]);

  const copyDrawnNumbers = () => {
    const drawnList = session?.state?.drawn ?? session?.drawn ?? [];
    const text = drawnList.join(", ");
    navigator.clipboard.writeText(text).then(() => {
      onToast?.("✅ Numeri copiati negli appunti!");
    });
  };

  const sendPlayerMessage = () => {
    if (!selectedPlayer || !playerMessage.trim()) {
      onToast?.("Seleziona un giocatore e scrivi un messaggio");
      return;
    }

    socket.emit("host:sendMessage", { 
      playerId: selectedPlayer,
      message: playerMessage.trim()
    }, (res) => {
      if (res?.ok) {
        onToast?.("✅ Messaggio inviato!");
        setPlayerMessage("");
        setShowMessageModal(false);
      } else {
        onToast?.(res?.error || "Errore invio messaggio");
      }
    });
  };

  const create = () => {
    socket.emit("host:create", { hostName, settings: { bnPerCard, splits } }, (res) => {
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

  const end = () => socket.emit("host:end", {}, () => onToast?.("Sessione terminata."));

  const importDrawn = () => {
    socket.emit("host:setDrawn", { text: importText }, (res) => {
      if (!res?.ok) return onToast?.(res?.error || "Errore import");
      onToast?.("✅ Estratti aggiornati");
    });
  };

  // Stats robust
  const totalCardsFromPlayers = (session?.players || []).reduce((a, p) => a + (p.cardsCount || 0), 0);
  const totalCards = session?.stats?.totalCards ?? totalCardsFromPlayers ?? 0;

  const bnEach = session?.settings?.bnPerCard ?? bnPerCard;
  const totalBN = session?.stats?.totalBN ?? totalCards * bnEach;

  const effectiveSplits = session?.settings?.splits ?? splits;
  const sumSplits = ORDER.reduce((a, k) => a + pct(effectiveSplits?.[k]), 0);

  const prizes = useMemo(() => allocatePrizes(totalBN, effectiveSplits), [totalBN, effectiveSplits]);

  const drawnList = session?.state?.drawn ?? session?.drawn ?? [];
  const last5 = session?.state?.last5 ?? session?.lastNumbers ?? drawnList.slice(-5);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Tomboliere</h2>

      {!code && (
        <>
          <div className="row">
            <div className="col">
              <label className="small">Nome</label>
              <input className="input" value={hostName} onChange={(e) => setHostName(e.target.value)} />
            </div>

            <div className="col">
              <label className="small">
                Gettoni per cartella (🎅 BN): <b>{bnPerCard}</b>
              </label>
              <input
                className="input"
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={bnPerCard}
                onChange={(e) => setBnPerCard(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div className="small" style={{ marginTop: 6 }}>
                <b>BN: {bnPerCard}</b>{" "}
                <span title="Info BN" style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => setShowBNInfo(true)}>
                  🎅
                </span>
              </div>
            </div>

            <div className="col card">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Ripartizione premi (slider)</div>

              {ORDER.map((k) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ width: 110, textTransform: "capitalize" }}>{k}</div>
                    <div className="small">
                      <b>{splits[k]}%</b>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splits[k]}
                    onChange={(e) => setSplits((s) => rebalanceSplits(s, k, e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              ))}

              <div className="small">
                Somma: <b>{ORDER.reduce((a, k) => a + pct(splits[k]), 0)}%</b> (sempre 100)
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={create}>
            Crea sessione
          </button>
        </>
      )}

      {code && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
            <span className="badge pill-gold">
              Codice sessione: <b style={{ marginLeft: 8 }}>{code}</b>
            </span>
            <span className="badge pill-gold">
              Cartelle totali: <b style={{ marginLeft: 8 }}>{totalCards}</b>
            </span>
            <span className="badge pill-gold">
              Totale punti:{" "}
              <b style={{ marginLeft: 8 }}>
                {totalBN} BN{" "}
                <span title="Info BN" style={{ cursor: "pointer", marginLeft: 6 }} onClick={() => setShowBNInfo(true)}>
                  🎅
                </span>
              </b>
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={draw} disabled={session?.ended}>
              Estrai numero
            </button>
            <button className="btn" onClick={end}>
              Termina
            </button>
            <button className="btn" onClick={copyDrawnNumbers}>
              📋 Copia numeri estratti
            </button>
            <button className="btn" onClick={() => setShowMessageModal(true)}>
              💬 Invia messaggio a giocatore
            </button>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Estrazione</h3>
              <div style={{ marginTop: 12 }}>
                <LastNumbers numbers={last5 || []} />
              </div>

              <div style={{ marginTop: 12 }}>
                <Board drawn={drawnList || []} />
              </div>

              <div style={{ marginTop: 12 }} className="card">
                <h3 style={{ marginTop: 0 }}>Ordine estrazione</h3>
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
              <h3 style={{ marginTop: 0 }}>Entra con QR</h3>
              <div className="small">Scansiona con la fotocamera</div>
              <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
                <div style={{ background: "white", padding: 10, borderRadius: 12 }}>
                  {qrImgSrc ? (
                    <img src={qrImgSrc} alt="QR" style={{ width: 220, height: 220, display: "block" }} />
                  ) : (
                    <div className="small">QR non disponibile</div>
                  )}
                </div>
              </div>
              <div className="small" style={{ textAlign: "center" }}>
                Oppure codice: <b>{session?.code}</b>
              </div>
              <hr />
              <div className="small">Link:</div>
              <div className="small" style={{ wordBreak: "break-all", opacity: 0.9 }}>
                {joinUrl}
              </div>
            </div>

            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Calcolo premi</h3>
              <div className="small">
                Montepremi = <b>{totalCards}</b> cartelle × <b>{bnEach}</b> BN = <b>{Math.floor(totalBN)}</b> BN
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Ripartizione: somma = <b>{sumSplits}%</b>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {ORDER.map((k) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ textTransform: "capitalize" }}>
                      {k} <span className="small">({pct(effectiveSplits?.[k]) || 0}%)</span>
                    </div>
                    <div>
                      <b>{prizes[k]} BN</b>
                    </div>
                  </div>
                ))}
              </div>

              <hr />
              <div className="small">
                Qui i BN sono <b>interi</b> e la somma dei premi è sempre uguale al montepremi.
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Riparti da un punto</h3>
              <div className="small">
                Incolla i numeri estratti (es: <b>1,2,3,10,90</b> o con spazi).
              </div>
              <textarea
                className="input"
                style={{ minHeight: 90, marginTop: 8 }}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Es: 5 12 33 45 90"
              />
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={importDrawn}>
                ✅ Imposta estratti
              </button>
            </div>

            <div className="col card">
              <h3 style={{ marginTop: 0 }}>Giocatori & cartelle</h3>
              <div className="small" style={{ opacity: 0.9, marginBottom: 8 }}>
                Totale (da giocatori): <b>{totalCardsFromPlayers}</b>
              </div>
              {session?.players?.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {session.players.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>🎄 {p.name}</div>
                      <div>
                        <b>{p.cardsCount}</b>
                      </div>
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
              <h3 style={{ marginTop: 0 }}>Cartelle di tutti (solo tomboliere)</h3>

              {hostView?.playersFull?.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {hostView.playersFull.map((p) => (
                    <div key={p.id} className="card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b>👤 {p.name}</b>
                        <span className="small">
                          Cartelle: <b>{p.cards?.length || 0}</b>
                        </span>
                      </div>

                      <div style={{ height: 8 }} />

                      {p.cards?.length ? (
                        <div className="row">
                          {p.cards.map((c) => (
                            <div className="col card" key={c.id}>
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
                              <CartellaView numbers={c.numbers} drawnSet={new Set(drawnList || [])} />
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

      {showBNInfo && (
        <div className="modal-backdrop" onClick={() => setShowBNInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>🎅 Babbi Natali (BN)</h3>
            <p className="small">
              In questa versione "Home" i <b>Babbi Natali (BN)</b> sono solo un'unità ludica per fare i conti tra
              amici/famiglia. Non è un sistema di pagamento, non è moneta, non crea obblighi.
            </p>
            <button className="btn" onClick={() => setShowBNInfo(false)}>
              Ok
            </button>
          </div>
        </div>
      )}

      {showMessageModal && (
        <div className="modal-backdrop" onClick={() => setShowMessageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>💬 Invia messaggio a giocatore</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="small">Seleziona giocatore:</label>
              <select 
                className="input"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">-- Seleziona giocatore --</option>
                {hostView?.playersFull?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="small">Messaggio:</label>
              <textarea 
                className="input"
                value={playerMessage}
                onChange={(e) => setPlayerMessage(e.target.value)}
                placeholder="Scrivi il messaggio per ripartire o altre istruzioni..."
                style={{ width: "100%", minHeight: 100 }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={sendPlayerMessage} disabled={!selectedPlayer || !playerMessage.trim()}>
                Invia
              </button>
              <button className="btn" onClick={() => setShowMessageModal(false)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}