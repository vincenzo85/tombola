import React, { useMemo } from "react";

function colIndexFor(n) {
  if (n === 90) return 8;
  if (n >= 1 && n <= 9) return 0;
  return Math.floor(n / 10);
}

export default function CartellaView({ 
  numbers, 
  drawnSet, 
  manuallyMarked,
  manualMode,
  onNumberClick,
  cardId,
  onDelete
}) {
  const processed = useMemo(() => {
    return numbers.map((rowNumbers) => {
      const fullRow = Array(9).fill(null);
      const sorted = [...rowNumbers].sort((a, b) => colIndexFor(a) - colIndexFor(b));

      for (const n of sorted) {
        const idx = colIndexFor(n);
        if (fullRow[idx] == null) {
          fullRow[idx] = n;
        } else {
          let j = idx + 1;
          while (j < 9 && fullRow[j] != null) j++;
          if (j < 9) fullRow[j] = n;
        }
      }

      return fullRow;
    });
  }, [numbers]);

  return (
    <div className="tombola-cartella" style={{ position: "relative" }}>
      {onDelete && (
        <button
          className="btn"
          onClick={onDelete}
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            background: "rgba(239,68,68,0.8)",
            padding: "4px 8px",
            fontSize: "12px",
            zIndex: 10,
            border: "1px solid rgba(239,68,68,1)"
          }}
          title="Elimina cartella"
        >
          🗑️
        </button>
      )}

      {processed.map((row, i) => (
        <div className="tombola-cartella__row" key={i}>
          {row.map((n, colIndex) => {
            // ✅ LOGICA CORRETTA: in modalità manuale ignora drawnSet
            const isDrawn = !manualMode && n != null && drawnSet?.has?.(n);
            const isManual = n != null && manuallyMarked?.has?.(n);
            const isHit = isDrawn || isManual;

            // Numero estratto ma non marcato manualmente (solo in modalità manuale)
            const isDrawnButNotMarked = manualMode && n != null && drawnSet?.has?.(n) && !isManual;

            return (
              <div
                key={colIndex}
                className={[
                  "tombola-cartella__cell",
                  n != null ? "is-number" : "is-empty",
                  isHit ? "is-hit" : "",
                  manualMode && n != null ? "is-clickable" : "",
                  isManual && !isDrawn ? "is-manual-only" : "",
                  isDrawnButNotMarked ? "is-drawn-not-marked" : ""
                ].join(" ")}
                onClick={() => {
                  if (manualMode && n != null && onNumberClick) {
                    onNumberClick(n);
                  }
                }}
                style={{
                  cursor: manualMode && n != null ? "pointer" : "default",
                  // Numero marcato solo manualmente (arancione)
                  ...(isManual && !isDrawn ? {
                    background: "rgba(245,158,11,0.3)",
                    borderColor: "rgba(245,158,11,0.7)"
                  } : {}),
                  // Numero estratto ma non marcato in modalità manuale (bordo dorato)
                  ...(isDrawnButNotMarked ? {
                    borderColor: "rgba(245,158,11,0.9)",
                    borderWidth: "2px",
                    borderStyle: "dashed"
                  } : {})
                }}
                title={
                  manualMode && n != null
                    ? isDrawnButNotMarked
                      ? `${n} (estratto - clicca per marcare)`
                      : `Click per ${isManual ? "de" : ""}selezionare ${n}`
                    : undefined
                }
              >
                {n ?? ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
