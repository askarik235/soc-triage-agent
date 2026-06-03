import React, { useState, useEffect } from "react";

const SHIELD = React.createElement("svg", { viewBox: "0 0 32 32", fill: "none", width: "100%", height: "100%" },
  React.createElement("path", { d: "M16 2L4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7L16 2z", stroke: "#fff", strokeWidth: "1.5", strokeLinejoin: "round" }),
  React.createElement("path", { d: "M16 11v6M13 14h6", stroke: "#fff", strokeWidth: "1.5", strokeLinecap: "round" })
);

const CSS = `
@keyframes alexBreathe { 0%,100% { opacity:.85; transform:translateX(-50%) scale(1);} 50% { opacity:1; transform:translateX(-50%) scale(1.04);} }
@keyframes alexEmblemGlow { 0%,100% { filter:drop-shadow(0 0 12px rgba(255,255,255,.15));} 50% { filter:drop-shadow(0 0 22px rgba(255,255,255,.3));} }
.alex-navlink { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:500; letter-spacing:.1em; color:#8e9192; text-decoration:none; text-transform:uppercase; transition:color .3s; }
.alex-navlink:hover { color:#fff; }
.alex-pill { font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.08em; color:#fff; text-transform:uppercase; border:1px solid #262626; border-radius:9999px; padding:9px 18px; background:transparent; cursor:pointer; transition:border-color .3s,background .3s; }
.alex-pill:hover { border-color:#fff; background:rgba(255,255,255,.04); }
.alex-btn-primary:hover { transform:translateY(-1px); box-shadow:0 0 30px rgba(255,255,255,.25); }
.alex-btn-ghost:hover { border-color:#fff !important; }
`;

export default function Intro({ onEnter }) {
  const [step, setStep] = useState(0);     // boot line index
  const [bootDone, setBootDone] = useState(false);
  const [sweep, setSweep] = useState(false);

  const bootLines = [
    { t: "Initializing secure channel...", tick: "\u25B8" },
    { t: "Loading threat intelligence...", tick: "\u25B8" },
    { t: "Calibrating triage protocols...", tick: "\u25B8" },
    { t: "Alex is ready.", tick: "\u2713" },
  ];

  useEffect(() => {
    if (step < bootLines.length) {
      const id = setTimeout(() => setStep(step + 1), step === 0 ? 500 : 650);
      return () => clearTimeout(id);
    } else {
      const id1 = setTimeout(() => setSweep(true), 100);
      const id2 = setTimeout(() => setBootDone(true), 1000);
      return () => { clearTimeout(id1); clearTimeout(id2); };
    }
  }, [step]);

  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "#000", overflow: "hidden", fontFamily: "'Hanken Grotesk', sans-serif", color: "#e2e2e2" } },
    React.createElement("style", null, CSS),

    // Boot overlay
    React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 20, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, transition: "opacity 1s ease", opacity: bootDone ? 0 : 1, pointerEvents: bootDone ? "none" : "auto" } },
      React.createElement("div", { style: { width: 54, height: 54, animation: "alexEmblemGlow 4s ease-in-out infinite" } }, SHIELD),
      React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.12em", color: "#8e9192", textAlign: "left", minWidth: 280 } },
        bootLines.map((l, idx) =>
          React.createElement("div", { key: idx, style: { opacity: idx < step ? 1 : 0, margin: "7px 0", display: "flex", alignItems: "center", gap: 8, transition: "opacity 0.4s" } },
            React.createElement("span", { style: { color: "#fff" } }, l.tick),
            l.t
          )
        )
      )
    ),

    // Scanline sweep
    React.createElement("div", { style: { position: "fixed", left: 0, right: 0, height: 1, zIndex: 21, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)", top: sweep ? "100%" : "0", opacity: sweep && !bootDone ? 1 : 0, transition: "top 0.9s ease, opacity 0.3s" } }),

    // Atmosphere: bloom + halo + horizon
    React.createElement("div", { style: { position: "fixed", inset: 0, overflow: "hidden", zIndex: 0 } },
      React.createElement("div", { style: { position: "absolute", left: "50%", bottom: "8%", width: 760, height: 760, transform: "translateX(-50%)", zIndex: 1, animation: "alexBreathe 6s ease-in-out infinite", background: "radial-gradient(circle at center, rgba(220,222,228,0.55) 0%, rgba(150,152,160,0.28) 18%, rgba(90,92,100,0.14) 34%, rgba(40,42,48,0.05) 52%, rgba(0,0,0,0) 70%)" } }),
      React.createElement("div", { style: { position: "absolute", left: "50%", bottom: "6%", width: 620, height: 620, transform: "translateX(-50%)", borderRadius: "50%", zIndex: 1, background: "radial-gradient(circle at center, transparent 61%, rgba(170,172,180,0.18) 62%, transparent 66%)" } }),
      React.createElement("div", { style: { position: "absolute", left: "50%", bottom: "-130%", width: "280%", height: "200%", transform: "translateX(-50%)", borderRadius: "50%", background: "#000", boxShadow: "0 -1px 0 0 rgba(180,180,185,0.35)", zIndex: 2 } })
    ),

    // Grain
    React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none", opacity: 0.04, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" } }),
    // Vignette
    React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)" } }),

    // Nav
    React.createElement("nav", { style: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 48px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
        React.createElement("span", { style: { width: 26, height: 26, display: "flex" } }, SHIELD),
        React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, letterSpacing: "0.18em", color: "#fff" } }, "ALEX")
      ),
      React.createElement("div", { style: { display: "flex", gap: 36 } },
        ["Console", "Incidents", "Playbooks", "About"].map((x) =>
          React.createElement("a", { key: x, href: "#", className: "alex-navlink", onClick: (e) => e.preventDefault() }, x)
        )
      ),
      React.createElement("button", { className: "alex-pill", onClick: onEnter }, "Start Session")
    ),

    // Hero
    React.createElement("div", { style: { position: "relative", zIndex: 5, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "center", paddingBottom: "6vh" } },
      React.createElement("div", { style: { width: 64, height: 64, marginBottom: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", animation: "alexEmblemGlow 6s ease-in-out infinite", background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)" } },
        React.createElement("span", { style: { width: 34, height: 34, display: "flex" } }, SHIELD)
      ),
      React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.28em", color: "#8e9192", textTransform: "uppercase", marginBottom: 26 } }, "AI-LED SECURITY OPERATIONS"),
      React.createElement("h1", { style: { fontSize: 58, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.04em", color: "#fff", marginBottom: 24 } },
        "Contain the threat.",
        React.createElement("br"),
        React.createElement("span", { style: { color: "#5d5f5f" } }, "Before it spreads.")
      ),
      React.createElement("p", { style: { fontSize: 17, fontWeight: 400, lineHeight: 1.6, color: "#8e9192", maxWidth: 440, marginBottom: 44 } }, "Report an incident and Alex assesses severity, builds a response plan, and opens a ticket - from alert to action in under a minute."),
      React.createElement("div", { style: { display: "flex", gap: 14 } },
        React.createElement("button", { className: "alex-btn-primary", onClick: onEnter, style: { fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 15, fontWeight: 500, borderRadius: 9999, padding: "14px 30px", cursor: "pointer", transition: "all 0.3s", border: "1px solid transparent", background: "#fff", color: "#0a0a0d" } }, "Enter Console"),
        React.createElement("button", { className: "alex-btn-ghost", onClick: onEnter, style: { fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 15, fontWeight: 500, borderRadius: 9999, padding: "14px 30px", cursor: "pointer", transition: "all 0.3s", border: "1px solid #262626", background: "transparent", color: "#fff" } }, "How it works")
      )
    )
  );
}
