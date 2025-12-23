import React from "react";

export default function CartellaView({ numbers, drawnSet }) {
  return (
    <div className="cartella">
      {numbers.map((row, i) => (
        <div className="cartellaRow" key={i}>
          {row.map((n) => (
            <div key={n} className={"num " + (drawnSet.has(n) ? "hit" : "")}>
              {n}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
