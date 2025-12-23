import React from "react";

export default function LastNumbers({ numbers }) {
  const last = Array.isArray(numbers) ? numbers : [];
  return last.length ? (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {last.slice(-5).map((n, i) => (
        <span key={i} className="badge pill-gold">
          <b>{n}</b>
        </span>
      ))}
    </div>
  ) : (
    <div className="small" style={{ opacity: 0.75 }}>
      (ancora nessuna estrazione)
    </div>
  );
}
