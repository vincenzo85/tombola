import React from "react";

export default function Home() {
  return (
    <div className="card">
      <h2 style={{marginTop:0}}>Scegli come entrare</h2>
      <div className="row">
        <div className="col card">
          <h3 style={{marginTop:0}}>Tomboliere</h3>
          <p className="small">Crea sessione, imposta premi, estrai numeri.</p>
          <button className="btn btn-primary" onClick={() => (window.location.hash = "/host")}>Sono il Tomboliere</button>
        </div>
        <div className="col card">
          <h3 style={{marginTop:0}}>Giocatore</h3>
          <p className="small">Entra con codice sessione e inserisci le cartelle.</p>
          <button className="btn" onClick={() => (window.location.hash = "/join")}>Sono un Giocatore</button>
        </div>
      </div>
      <hr />
      <p className="small">
        Suggerimento: il tomboliere crea una sessione e condivide il <b>codice</b> agli altri.
      </p>
<hr />
<div className="small">
  🎄 <b>Gioco natalizio amatoriale</b> (AS IS).<br/>
  I “Babbi Natali (BN)” sono <b>punti fittizi</b> usati solo per fare i conti in modo simpatico.<br/>
  <b>Non sono denaro</b>, non sono credito, non sono premi, non hanno valore economico.<br/>
  Eventuali accordi tra amici avvengono <b>fuori dall’app</b> e non sono gestiti dal sito.<br/>
  Se ti va, “pagami” con un like o condividendo il gioco con gli amici 🎁
</div>
    </div>
  );
}
