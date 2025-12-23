import React, { useMemo } from "react";

export default function Board({ drawn }) {
  const set = useMemo(() => new Set(drawn || []), [drawn]);
  const nums = [];
  for (let i = 1; i <= 90; i++) nums.push(i);

  return (
    <div className="grid90">
      {nums.map(n => (
        <div key={n} className={"cell " + (set.has(n) ? "on" : "")}>{n}</div>
      ))}
    </div>
  );
}
