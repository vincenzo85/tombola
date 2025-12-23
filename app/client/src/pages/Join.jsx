import React, { useEffect, useMemo, useRef, useState } from "react";

function getCodeFromHash() {
  const h = window.location.hash.replace("#", "");
  const q = h.split("?")[1] || "";
  const p = new URLSearchParams(q);
  return (p.get("code") || "").toUpperCase();
}

function parseScanned(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  if (t.toUpperCase().startsWith("TOMBOLA:")) return t.split(":")[1].trim().toUpperCase();
  try {
    const u = new URL(t);
    const hash = u.hash || "";
    const q = hash.includes("?") ? hash.split("?")[1] : "";
    const p = new URLSearchParams(q);
    const code = p.get("code");
    if (code) return String(code).toUpperCase();
  } catch {}
  return t.toUpperCase();
}

export default function Join({ socket, onToast }) {
  const [code, setCode] = useState(() => getCodeFromHash() || "");
  const [name, setName] = useState(localStorage.getItem("tombola_name") || "");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanErr, setScanErr] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const canJoin = useMemo(() => code.trim() && name.trim(), [code, name]);

  useEffect(() => {
    const onHash = () => {
      const c = getCodeFromHash();
      if (c) setCode(c);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const stop = async () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const loop = async (detector) => {
      try {
        const video = videoRef.current;
        if (!video) return;
        const barcodes = await detector.detect(video);
        if (barcodes?.length) {
          const raw = barcodes[0]?.rawValue || "";
          const c = parseScanned(raw);
          if (c) {
            setCode(c);
            setScanOpen(false);
            onToast?.("Codice letto ✅");
            await stop();
            return;
          }
        }
      } catch (e) {
        // ignore occasional frames
      }
      rafRef.current = requestAnimationFrame(() => loop(detector));
    };

    const start = async () => {
      try {
        setScanErr(null);
        if (!("BarcodeDetector" in window)) {
          setScanErr("Scanner non supportato dal browser. Usa Chrome su Android oppure inserisci il codice manualmente.");
          return;
        }
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        rafRef.current = requestAnimationFrame(() => loop(detector));
      } catch (e) {
        setScanErr(e?.message || "Errore fotocamera");
      }
    };

    if (scanOpen) start();
    else stop();

    return () => stop();
  }, [scanOpen, onToast]);

  const joinNow = () => {
    socket.emit("session:join", { code, name }, (res) => {
      if (!res?.ok) return onToast?.(res?.error || "Errore join");
      localStorage.setItem("tombola_code", res.session.code);
      localStorage.setItem("tombola_playerId", res.playerId);
      localStorage.setItem("tombola_name", name);
      onToast?.("Connesso alla sessione!");
      window.location.hash = "/player";
    });
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Entra come Giocatore</h2>

      <label className="small">Codice sessione</label>
      <input
        className="input"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ES: A1B2C3"
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => setScanOpen((v) => !v)}>
          📷 {scanOpen ? "Chiudi scanner" : "Scansiona QR"}
        </button>
      </div>

      {scanOpen && (
        <div style={{ marginTop: 12 }}>
          <video ref={videoRef} style={{ width: "100%", borderRadius: 14, border: "1px solid rgba(255,255,255,.12)" }} playsInline />
          {scanErr && <div className="small" style={{ marginTop: 8 }}>Errore: {scanErr}</div>}
          <div className="small" style={{ marginTop: 8 }}>Se richiesto, consenti l’accesso alla fotocamera.</div>
        </div>
      )}

      <div style={{ height: 10 }} />
      <label className="small">Nickname</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es: Vincenzo" />

      <div style={{ height: 12 }} />
      <button className="btn btn-primary" onClick={joinNow} disabled={!canJoin}>
        Entra
      </button>

      <hr />
      <button className="btn" onClick={() => (window.location.hash = "/")}>
        ← Home
      </button>
    </div>
  );
}
