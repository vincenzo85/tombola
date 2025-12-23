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
        I "Babbi Natali (BN)" sono <b>punti fittizi</b> usati solo per fare i conti in modo simpatico.<br/>
        <b>Non sono denaro</b>, non sono credito, non sono premi, non hanno valore economico.<br/>
        Eventuali accordi tra amici avvengono <b>fuori dall'app</b> e non sono gestiti dal sito.<br/>
        Se ti va, "pagami" con un like o condividendo il gioco con gli amici 🎁
      </div>
      
      <hr />
      <div style={{
        textAlign: "center",
        marginTop: "20px",
        padding: "20px",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div className="small" style={{ marginBottom: "12px", fontWeight: 600 }}>
          Ideato e realizzato da <b>Vincenzo Di Franco</b>
        </div>
        
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap", marginBottom: "15px" }}>
          <a 
            href="mailto:vincenzo.difranco@gmail.com"
            style={{
              color: "#4b6bff",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background: "rgba(75,107,255,0.1)",
              borderRadius: "8px",
              transition: "all 0.2s ease"
            }}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(75,107,255,0.2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(75,107,255,0.1)"}
          >
            <span style={{ fontSize: "18px" }}>✉️</span>
            <span>Email</span>
          </a>
          
          <a 
            href="https://www.linkedin.com/in/vincenzo-di-franco-38216645/"
            style={{
              color: "#0a66c2",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background: "rgba(10,102,194,0.1)",
              borderRadius: "8px",
              transition: "all 0.2s ease"
            }}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(10,102,194,0.2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(10,102,194,0.1)"}
          >
            <span style={{ fontSize: "18px" }}>💼</span>
            <span>LinkedIn</span>
          </a>
          
          <a 
            href="https://paypal.me/elettrotecnica"
            style={{
              color: "#003087",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background: "linear-gradient(90deg, rgba(0,48,135,0.1) 0%, rgba(0,156,222,0.1) 100%)",
              borderRadius: "8px",
              transition: "all 0.2s ease",
              border: "1px solid rgba(0,48,135,0.2)"
            }}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={(e) => e.currentTarget.style.background = "linear-gradient(90deg, rgba(0,48,135,0.2) 0%, rgba(0,156,222,0.2) 100%)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "linear-gradient(90deg, rgba(0,48,135,0.1) 0%, rgba(0,156,222,0.1) 100%)"}
          >
            <span style={{ fontSize: "18px" }}>☕</span>
            <span>Offrimi un caffè (PayPal)</span>
          </a>
        </div>
        
        <div className="small" style={{ 
          marginTop: "15px", 
          padding: "12px",
          background: "rgba(245,158,11,0.1)",
          borderRadius: "8px",
          border: "1px solid rgba(245,158,11,0.2)",
          color: "rgba(255,255,255,0.9)",
          lineHeight: "1.5"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "16px" }}>🖥️</span>
            <span style={{ fontWeight: 600 }}>Questo progetto vive su un piccolo server</span>
          </div>
          <div style={{ fontSize: "13px" }}>
            Se vuoi aiutarmi a tenerlo acceso, un caffè ☕ è più che sufficiente.<br/>
            Grazie davvero per il tuo supporto! 🙏
          </div>
        </div>
        
        <div className="small" style={{ marginTop: "15px", opacity: 0.7 }}>
          Buon divertimento! 🎄✨
        </div>
      </div>
    </div>
  );
}