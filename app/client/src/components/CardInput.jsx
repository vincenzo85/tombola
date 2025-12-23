import React, { useState } from "react";

function parseRow(s) {
  return s
    .split(/[\s,;]+/g)
    .map(x => x.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => Number.isFinite(n));
}

export default function CardInput({ onSubmit }) {
  const [r1, setR1] = useState("");
  const [r2, setR2] = useState("");
  const [r3, setR3] = useState("");
  const [error, setError] = useState(null);

  const submit = () => {
    const a = parseRow(r1);
    const b = parseRow(r2);
    const c = parseRow(r3);

    if (a.length !== 5 || b.length !== 5 || c.length !== 5) {
      return setError("Ogni riga deve contenere esattamente 5 numeri.");
    }
    const flat = [...a, ...b, ...c];
    const set = new Set(flat);
    if (set.size !== flat.length) return setError("Niente duplicati nella stessa cartella.");
    if (flat.some(n => n < 1 || n > 90 || !Number.isInteger(n))) return setError("Numeri validi: interi tra 1 e 90.");

    setError(null);
    onSubmit?.([a, b, c]);
    setR1(""); setR2(""); setR3("");
  };

  return (
    <div>
      <input className="input" value={r1} onChange={(e)=>setR1(e.target.value)} placeholder="Riga 1: es. 1 12 23 34 45" />
      <div style={{height:8}} />
      <input className="input" value={r2} onChange={(e)=>setR2(e.target.value)} placeholder="Riga 2: es. 2 13 24 35 46" />
      <div style={{height:8}} />
      <input className="input" value={r3} onChange={(e)=>setR3(e.target.value)} placeholder="Riga 3: es. 3 14 25 36 47" />
      <div style={{height:10}} />
      <button className="btn" onClick={submit}>Aggiungi cartella</button>
      {error && <div className="small" style={{marginTop:8, color:"#ffb3b3"}}>{error}</div>}
    </div>
  );
}
