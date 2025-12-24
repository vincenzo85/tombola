import React, { useMemo } from "react";

function colIndexFor(n) {
  if (n === 90) return 8;
  if (n >= 1 && n <= 9) return 0;
  return Math.floor(n / 10); // 10->1, 19->1, 20->2...
}

export default function CartellaView({ numbers, drawnSet }) {
  // numbers deve essere: [ [5 numeri], [5 numeri], [5 numeri] ]
  const processed = useMemo(() => {
    return numbers.map((rowNumbers) => {
      const fullRow = Array(9).fill(null);

      // Ordina per colonna così “visivamente” è sempre coerente
      const sorted = [...rowNumbers].sort((a, b) => colIndexFor(a) - colIndexFor(b));

      for (const n of sorted) {
        const idx = colIndexFor(n);

        // In una cartella reale non dovrebbero esistere collisioni di colonna nella stessa riga.
        // Se succede (dati sporchi), non sovrascrivere: cerca la prossima cella vuota a dx.
        if (fullRow[idx] == null) {
          fullRow[idx] = n;
        } else {
          let j = idx + 1;
          while (j < 9 && fullRow[j] != null) j++;
          if (j < 9) fullRow[j] = n;
          // se non c’è spazio, lo scarti (ma meglio validare a monte)
        }
      }

      return fullRow;
    });
  }, [numbers]);

  return (
    <div className="tombola-cartella">
      {processed.map((row, i) => (
        <div className="tombola-cartella__row" key={i}>
          {row.map((n, colIndex) => {
            const hit = n != null && drawnSet?.has?.(n);
            return (
              <div
                key={colIndex}
                className={[
                  "tombola-cartella__cell",
                  n != null ? "is-number" : "is-empty",
                  hit ? "is-hit" : "",
                ].join(" ")}
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
