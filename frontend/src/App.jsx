import React, { useState, useRef, useEffect } from "react";
import { useOmniagent } from "./hooks/useOmniagent";

const BACKEND_URL = "http://localhost:3001";
const CLIENT_KEY = import.meta.env.VITE_CLIENT_KEY || "";
const CK_HEADERS = { "x-client-key": CLIENT_KEY };
const SUGGESTIONS = ["Phishing", "Ransomware", "Unauthorized access", "Data exfiltration"];

const GLOSSARY = {
  "containment": "Stopping the problem from spreading further.",
  "isolate": "Disconnect a device from the network so the threat cannot reach other systems.",
  "forensic image": "An exact copy of a drive saved as evidence before any changes are made.",
  "malicious ips": "Internet addresses known to be controlled by attackers.",
  "ransomware variant": "The specific family/strain of ransomware, which tells you how it behaves.",
  "access vector": "The way the attacker first got in (e.g. a phishing email or exposed login).",
  "rdp": "Remote Desktop Protocol - a way to control a PC over the internet; often abused by attackers.",
  "exploit": "Code that takes advantage of a software flaw to break in.",
  "encrypted systems": "Machines whose files the ransomware has locked.",
  "backups": "Saved copies of data you can restore from.",
  "eradication": "Fully removing the threat from all systems.",
  "credentials": "Usernames and passwords.",
  "vulnerability": "A weakness in software that can be attacked.",
  "re-infection": "The threat coming back after you thought it was removed.",
  "ciso": "Chief Information Security Officer - the executive responsible for security.",
  "breach notification": "Legally informing affected people that their data may have been exposed.",
  "lateral movement": "An attacker spreading from one system to others inside the network.",
  "privilege escalation": "An attacker gaining higher access rights than they started with.",
  "mfa": "Multi-Factor Authentication - a second login step like a phone code.",
  "phishing": "Fake emails or pages that trick people into giving up passwords.",
  "quarantine": "Moving a suspicious file or email somewhere it cannot cause harm.",
  "ddos": "Distributed Denial of Service - flooding a system with traffic to knock it offline.",
  "scrubbing service": "A service that filters out attack traffic before it reaches you.",
  "persistence": "Hidden footholds attackers leave so they can return.",
  "backdoor": "A secret way back into a system left by an attacker.",
};

const PRIORITY_STYLE = {
  P1: { solid: true, label: "P1 SEVERITY", glow: true },
  P2: { solid: false, label: "P2 SEVERITY", glow: false },
  P3: { solid: false, muted: true, label: "P3 SEVERITY", glow: false },
  P4: { solid: false, muted: true, label: "P4 SEVERITY", glow: false },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@keyframes alexPulseRing { 0%{box-shadow:0 0 0 0 rgba(255,255,255,.4);} 70%{box-shadow:0 0 0 6px rgba(255,255,255,0);} 100%{box-shadow:0 0 0 0 rgba(255,255,255,0);} }
@keyframes alexCritGlow { 0%,100%{box-shadow:0 0 24px rgba(255,255,255,.06);border-color:#262626;} 50%{box-shadow:0 0 44px rgba(255,255,255,.14);border-color:#555;} }
@keyframes alexRise { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
@keyframes alexFadeIn { from{opacity:0;} to{opacity:1;} }
.alex-link { position:relative; transition:color .3s; }
.alex-link:hover { color:#fff !important; }
.alex-link.active { color:#fff !important; }
.alex-chip:hover { border-color:#fff !important; color:#fff !important; }
.alex-send:hover { box-shadow:0 0 24px rgba(255,255,255,.3); }
.alex-jargon { border-bottom:1px dotted #5f5f5f; cursor:help; }
.alex-sec:hover { background:#141414; }
.alex-card-hover:hover { border-color:#3a3a3a !important; background:#0d0d10 !important; }
.alex-scroll::-webkit-scrollbar { width:6px; }
.alex-scroll::-webkit-scrollbar-thumb { background:#262626; border-radius:3px; }
.alex-btn-ghost:hover { border-color:#fff !important; }
.alex-btn-primary:hover { transform:translateY(-1px); box-shadow:0 0 30px rgba(255,255,255,.25); }
`;

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const SHIELD = React.createElement("svg", { viewBox: "0 0 32 32", fill: "none", width: "100%", height: "100%" },
  React.createElement("path", { d: "M16 2L4 7v8c0 7 5 12 12 15 7-3 12-8 12-15V7L16 2z", stroke: "#fff", strokeWidth: "1.5", strokeLinejoin: "round" }),
  React.createElement("path", { d: "M16 11v6M13 14h6", stroke: "#fff", strokeWidth: "1.5", strokeLinecap: "round" })
);

function annotateJargon(text) {
  if (!text) return text;
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp("\\b(" + escaped.join("|") + ")\\b", "gi");
  const parts = [];
  let lastIndex = 0, m, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(React.createElement("span", { key: "j" + k++, title: GLOSSARY[m[0].toLowerCase()], className: "alex-jargon" }, m[0]));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function looksLikeActionPlan(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return (t.includes("containment") && (t.includes("investigation") || t.includes("recovery")));
}

function parsePlan(text) {
  const sections = { containment: [], investigation: [], recovery: [], notification: [] };
  const lower = text.toLowerCase();
  let priority = null;
  const pMatch = text.match(/\b(P[1-4])\b/);
  if (pMatch) priority = pMatch[1];
  const order = [
    { key: "containment", names: ["containment", "for containment"] },
    { key: "investigation", names: ["investigation", "for investigation"] },
    { key: "recovery", names: ["recovery", "for recovery"] },
    { key: "notification", names: ["notification", "notify", "for notification"] },
  ];
  function extractSteps(chunk) {
    const numbered = chunk.split(/\d+\.\s+/).map(s => s.trim()).filter(Boolean);
    if (numbered.length > 1) return numbered.map(s => s.replace(/\.$/, "").trim()).filter(s => s.length > 3);
    return chunk.split(/\.(?:\s+|$)/).map(s => s.trim()).filter(s => s.length > 5);
  }
  const positions = [];
  for (const sec of order) {
    for (const name of sec.names) {
      const idx = lower.indexOf(name);
      if (idx !== -1) { positions.push({ key: sec.key, idx, name }); break; }
    }
  }
  positions.sort((a, b) => a.idx - b.idx);
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx + positions[i].name.length;
    const end = i + 1 < positions.length ? positions[i + 1].idx : text.length;
    sections[positions[i].key] = extractSteps(text.slice(start, end).replace(/^[:\s-]+/, ""));
  }
  return { priority, sections };
}

const SECTION_META = {
  containment: { title: "CONTAINMENT", icon: "\u25C8" },
  investigation: { title: "INVESTIGATION", icon: "\u25C9" },
  recovery: { title: "RECOVERY", icon: "\u25CC" },
  notification: { title: "NOTIFY", icon: "\u25A3" },
};

function Section({ sectionKey, steps, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = SECTION_META[sectionKey];
  if (!steps || steps.length === 0) return null;
  return React.createElement("div", { style: { borderTop: "1px solid #1c1c1c" } },
    React.createElement("div", { className: "alex-sec", onClick: () => setOpen(!open), style: { display: "flex", alignItems: "center", gap: 12, padding: "14px 4px", cursor: "pointer", transition: "background 0.2s" } },
      React.createElement("span", { style: { color: "#8e9192", fontSize: 13, width: 16 } }, meta.icon),
      React.createElement("span", { style: { flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.12em", color: "#e2e2e2" } }, meta.title),
      React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5f5f5f" } }, steps.length),
      React.createElement("span", { style: { color: "#5f5f5f", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.3s" } }, "\u25BE")
    ),
    open && React.createElement("div", { style: { padding: "0 4px 14px 32px" } },
      steps.map((step, i) =>
        React.createElement("div", { key: i, style: { display: "flex", gap: 12, padding: "6px 0", fontSize: 14, lineHeight: 1.55, color: "#c4c7c8" } },
          React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", color: "#5f5f5f", fontSize: 12, minWidth: 18 } }, (i + 1 < 10 ? "0" : "") + (i + 1)),
          React.createElement("span", null, annotateJargon(step))
        )
      )
    )
  );
}

function PriorityChip({ priority }) {
  const ps = PRIORITY_STYLE[priority] || PRIORITY_STYLE.P3;
  if (ps.solid) {
    return React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", background: "#fff", color: "#0a0a0d", fontWeight: 500, boxShadow: ps.glow ? "0 0 20px rgba(255,255,255,0.35)" : "none" } },
      React.createElement("span", { style: { width: 6, height: 6, background: "#0a0a0d", display: "inline-block" } }), ps.label);
  }
  return React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", background: "transparent", color: ps.muted ? "#8e9192" : "#fff", border: "1px solid " + (ps.muted ? "#444" : "#fff") } },
    React.createElement("span", { style: { width: 6, height: 6, background: ps.muted ? "#8e9192" : "#fff", display: "inline-block" } }), ps.label);
}

function ActionPlanCard({ text }) {
  const { priority, sections } = parsePlan(text);
  const isCrit = priority === "P1";
  const incidentId = "0x" + Math.random().toString(16).slice(2, 6).toUpperCase();
  return React.createElement("div", { style: { background: "#0a0a0d", border: "1px solid #262626", borderRadius: 4, padding: "22px 24px", maxWidth: 620, animation: isCrit ? "alexCritGlow 4s ease-in-out infinite" : "none" } },
    React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "#5f5f5f", marginBottom: 8 } }, "INCIDENT ID: " + incidentId),
        React.createElement("div", { style: { fontSize: 19, fontWeight: 500, color: "#fff", letterSpacing: "-0.01em" } }, "Response Plan")
      ),
      React.createElement(PriorityChip, { priority })
    ),
    React.createElement(Section, { sectionKey: "containment", steps: sections.containment, defaultOpen: true }),
    React.createElement(Section, { sectionKey: "investigation", steps: sections.investigation, defaultOpen: false }),
    React.createElement(Section, { sectionKey: "recovery", steps: sections.recovery, defaultOpen: false }),
    React.createElement(Section, { sectionKey: "notification", steps: sections.notification, defaultOpen: false }),
    React.createElement("div", { style: { borderTop: "1px solid #1c1c1c", marginTop: 4, paddingTop: 16 } },
      React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: "#5f5f5f" } }, "PRODUCTION-IMPACTING STEPS REQUIRE ANALYST SIGN-OFF")
    )
  );
}

function Msg({ msg }) {
  if (msg.role === "agent" && looksLikeActionPlan(msg.text)) {
    return React.createElement("div", { style: { animation: "alexRise 0.4s ease", marginLeft: 32 } }, React.createElement(ActionPlanCard, { text: msg.text }));
  }
  if (msg.role === "user") {
    return React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", animation: "alexRise 0.4s ease" } },
      React.createElement("div", { style: { maxWidth: "62%", background: "#1a1a1a", border: "1px solid #262626", borderRadius: 6, padding: "14px 18px", fontSize: 15, lineHeight: 1.55, color: "#e2e2e2" } }, msg.text));
  }
  if (msg.role === "system") {
    return React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "#5f5f5f", paddingLeft: 32 } }, msg.text);
  }
  return React.createElement("div", { style: { animation: "alexRise 0.4s ease", paddingLeft: 32, borderLeft: "1px solid #333", position: "relative" } },
    React.createElement("div", { style: { position: "absolute", left: -1, top: 0, width: 1, height: 18, background: "#fff" } }),
    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", color: "#5f5f5f", marginBottom: 6 } }, "ALEX"),
    React.createElement("div", { style: { fontSize: 16, lineHeight: 1.6, color: "#e2e2e2", maxWidth: 620 } }, annotateJargon(msg.text))
  );
}

// ============ MEMORY DRAWER ============
function MemoryDrawer({ open, onClose, refreshKey }) {
  const [mem, setMem] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMem(null); setError(false);
    fetch(BACKEND_URL + "/memory/analyst-001", { headers: CK_HEADERS }).then(r => r.json()).then(d => setMem(d.memory || [])).catch(() => setError(true));
  }, [open, refreshKey]);

  return React.createElement(React.Fragment, null,
    // Backdrop
    open && React.createElement("div", { onClick: onClose, style: { position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)", animation: "alexFadeIn 0.3s ease" } }),
    // Drawer
    React.createElement("div", { style: { position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "90vw", zIndex: 50, background: "#060608", borderLeft: "1px solid #262626", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)", display: "flex", flexDirection: "column", boxShadow: open ? "-30px 0 60px rgba(0,0,0,0.6)" : "none" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px", borderBottom: "1px solid #1c1c1c" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", color: "#5f5f5f", marginBottom: 6 } }, "PERSISTENT MEMORY"),
          React.createElement("div", { style: { fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" } }, "What Alex Remembers")
        ),
        React.createElement("button", { onClick: onClose, style: { background: "transparent", border: "none", color: "#8e9192", fontSize: 20, cursor: "pointer", lineHeight: 1 } }, "\u00D7")
      ),
      React.createElement("div", { className: "alex-scroll", style: { flex: 1, overflowY: "auto", padding: "20px 24px" } },
        React.createElement("div", { style: { fontSize: 13, color: "#8e9192", lineHeight: 1.6, marginBottom: 24 } }, "Alex retains every incident across sessions, keyed to this analyst. Each entry includes what was learned for faster future triage."),
        error ? React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8e9192", padding: 20, border: "1px solid #262626", borderRadius: 4 } }, "Backend offline.") :
        mem === null ? React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#5f5f5f" } }, "Recalling...") :
        mem.length === 0 ? React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#5f5f5f", padding: 20, border: "1px solid #1c1c1c", borderRadius: 4, lineHeight: 1.6 } }, "No memories yet. Triage an incident and it will be remembered here.") :
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
          mem.map((it) => React.createElement("div", { key: it.id, style: { background: "#0a0a0d", border: "1px solid #1c1c1c", borderRadius: 4, padding: "16px 18px" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } },
              React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#fff", letterSpacing: "0.04em" } }, it.id),
              React.createElement(PriorityChip, { priority: it.priority })
            ),
            React.createElement("div", { style: { fontSize: 14, color: "#e2e2e2", lineHeight: 1.5, marginBottom: 12 } }, it.summary),
            React.createElement("div", { style: { display: "flex", gap: 9, alignItems: "flex-start", background: "#0e0e12", border: "1px solid #1c1c1c", borderRadius: 4, padding: "10px 12px" } },
              React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#5f5f5f", paddingTop: 2, whiteSpace: "nowrap" } }, "LEARNED"),
              React.createElement("span", { style: { fontSize: 13, color: "#c4c7c8", lineHeight: 1.5 } }, annotateJargon(it.learned))
            ),
            React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.06em", color: "#3a3a3a", marginTop: 10 } }, new Date(it.created_at).toLocaleString())
          ))
        )
      )
    )
  );
}

// ============ CONSOLE VIEW ============
function ConsoleView({ onOpenMemory }) {
  const [input, setInput] = useState("");
  const ref = useRef(null);
  const a = useOmniagent({ userId: "analyst-001" });
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [a.messages]);
  const send = () => { const t = input.trim(); if (!t || !a.isConnected) return; a.sendMessage(t); setInput(""); };
  const key = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return React.createElement("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
    React.createElement("div", { className: "alex-scroll", style: { flex: 1, overflowY: "auto", padding: "50px 40px 40px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1040, width: "100%", margin: "0 auto" } },
      a.messages.length === 0 ?
        React.createElement("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center", marginTop: "8vh" } },
          React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#5f5f5f" } }, "AWAITING INCIDENT REPORT"),
          React.createElement("div", { style: { fontSize: 22, fontWeight: 500, color: "#e2e2e2", letterSpacing: "-0.02em", maxWidth: 440, lineHeight: 1.3 } }, "Describe a security incident to begin triage."),
          React.createElement("div", { style: { fontSize: 14, color: "#8e9192", maxWidth: 380, lineHeight: 1.6 } }, "Alex assesses severity, builds a response plan, and opens a ticket. Hover any underlined term for a definition."),
          !a.isConnected && React.createElement("button", { onClick: a.connect, className: "alex-send", style: { marginTop: 12, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 14, fontWeight: 500, background: "#fff", color: "#0a0a0d", border: "none", borderRadius: 9999, padding: "13px 30px", cursor: "pointer", transition: "all 0.3s" } }, a.status === "connecting" ? "Connecting..." : "Open Channel")
        ) :
        a.messages.map((m) => React.createElement(Msg, { key: m.id, msg: m })),
      React.createElement("div", { ref: ref })
    ),
    React.createElement("div", { style: { padding: "16px 40px 28px", maxWidth: 1040, width: "100%", margin: "0 auto" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } },
        React.createElement("div", { style: { display: "flex", gap: 10 } },
          a.isConnected && a.messages.length <= 2 ? SUGGESTIONS.map((s) => React.createElement("button", { key: s, onClick: () => a.sendMessage("We have a " + s.toLowerCase() + " incident"), className: "alex-chip", style: { display: "flex", alignItems: "center", gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em", color: "#8e9192", textTransform: "uppercase", border: "1px solid #262626", borderRadius: 9999, padding: "7px 14px", background: "transparent", cursor: "pointer", transition: "all 0.3s" } },
            React.createElement("span", { style: { width: 4, height: 4, borderRadius: "50%", background: "#5f5f5f" } }), s)) : null
        ),
        React.createElement("button", { onClick: onOpenMemory, className: "alex-chip", style: { display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em", color: "#8e9192", textTransform: "uppercase", border: "1px solid #262626", borderRadius: 9999, padding: "7px 16px", background: "transparent", cursor: "pointer", transition: "all 0.3s", whiteSpace: "nowrap" } },
          React.createElement("span", { style: { fontSize: 13 } }, "\u25C9"), "Memory")
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14, background: "#0a0a0d", border: "1px solid #262626", borderRadius: 4, padding: "6px 6px 6px 20px" } },
        React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", color: "#5f5f5f", fontSize: 15 } }, ">"),
        React.createElement("input", { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: key, disabled: !a.isConnected, placeholder: a.isConnected ? "Describe the incident..." : "Open the channel to begin...", style: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e2e2", fontSize: 15, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em", padding: "14px 0" } }),
        React.createElement("button", { onClick: send, disabled: !a.isConnected || !input.trim(), className: "alex-send", style: { width: 44, height: 44, borderRadius: "50%", background: input.trim() && a.isConnected ? "#fff" : "#1a1a1a", color: input.trim() && a.isConnected ? "#0a0a0d" : "#5f5f5f", border: "none", cursor: input.trim() && a.isConnected ? "pointer" : "default", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s", flexShrink: 0 } }, "\u2191")
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 } },
        React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: a.isConnected ? "#fff" : "#444", animation: a.isConnected ? "alexPulseRing 2s infinite" : "none" } }),
        React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#5f5f5f" } }, a.isConnected ? "SECURE CHANNEL ACTIVE" : a.status === "connecting" ? "ESTABLISHING..." : "CHANNEL OFFLINE")
      )
    )
  );
}

// ============ INCIDENTS VIEW ============
const PLAN_META = {
  containment: { title: "CONTAINMENT", icon: "\u25C8" },
  investigation: { title: "INVESTIGATION", icon: "\u25C9" },
  recovery: { title: "RECOVERY", icon: "\u25CC" },
  notify: { title: "NOTIFY", icon: "\u25A3" },
};

function PlanBlock({ plan }) {
  if (!plan) return React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5f5f5f", paddingTop: 14, marginTop: 14, borderTop: "1px solid #1c1c1c" } }, "No recovery plan stored for this incident.");
  const order = ["containment", "investigation", "recovery", "notify"];
  return React.createElement("div", { style: { paddingTop: 16, marginTop: 16, borderTop: "1px solid #1c1c1c", animation: "alexFadeIn 0.3s ease" } },
    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.15em", color: "#5f5f5f", marginBottom: 16 } }, "RECOVERY PLAN"),
    order.map((key) => {
      const steps = plan[key];
      if (!steps || !steps.length) return null;
      const meta = PLAN_META[key];
      return React.createElement("div", { key: key, style: { marginBottom: 16 } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } },
          React.createElement("span", { style: { color: "#8e9192", fontSize: 12 } }, meta.icon),
          React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", color: "#e2e2e2" } }, meta.title)
        ),
        steps.map((s, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 10, padding: "4px 0 4px 22px", fontSize: 13, lineHeight: 1.5, color: "#c4c7c8" } },
          React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", color: "#5f5f5f", fontSize: 11, minWidth: 16 } }, "0" + (i + 1)),
          React.createElement("span", null, annotateJargon(s))
        ))
      );
    })
  );
}

function IncidentCard({ t }) {
  const [open, setOpen] = useState(false);
  return React.createElement("div", { className: "alex-card-hover", style: { background: "#0a0a0d", border: "1px solid #262626", borderRadius: 4, padding: "20px 24px", transition: "all 0.3s" } },
    React.createElement("div", { onClick: () => setOpen(!open), style: { cursor: "pointer" } },
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 } },
        React.createElement("div", null,
          React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#fff", letterSpacing: "0.05em" } }, t.id),
          React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5f5f5f", marginLeft: 12, textTransform: "uppercase" } }, t.incident_type)
        ),
        React.createElement(PriorityChip, { priority: t.priority })
      ),
      React.createElement("div", { style: { fontSize: 15, color: "#e2e2e2", lineHeight: 1.5, marginBottom: 14 } }, t.summary),
      React.createElement("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.06em", color: "#5f5f5f", alignItems: "center" } },
        React.createElement("span", null, "STATUS: ", React.createElement("span", { style: { color: t.status === "ESCALATED" ? "#fff" : "#8e9192" } }, t.status)),
        React.createElement("span", null, "ASSIGNED: ", React.createElement("span", { style: { color: "#8e9192" } }, t.assigned_to || "SOC Queue")),
        t.affected_systems && React.createElement("span", null, "SYSTEMS: ", React.createElement("span", { style: { color: "#8e9192" } }, t.affected_systems)),
        React.createElement("span", { style: { marginLeft: "auto", color: "#8e9192", display: "flex", alignItems: "center", gap: 6 } }, open ? "HIDE PLAN" : "VIEW PLAN", React.createElement("span", { style: { transform: open ? "rotate(180deg)" : "none", transition: "transform 0.3s", display: "inline-block" } }, "\u25BE"))
      )
    ),
    open && React.createElement(PlanBlock, { plan: t.recovery_plan })
  );
}

function IncidentsView() {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(BACKEND_URL + "/tickets", { headers: CK_HEADERS }).then(r => r.json()).then(d => setTickets(d.tickets || [])).catch(() => setError(true));
  }, []);
  return React.createElement("div", { className: "alex-scroll", style: { flex: 1, overflowY: "auto", padding: "60px 40px", maxWidth: 1040, width: "100%", margin: "0 auto", animation: "alexFadeIn 0.5s ease" } },
    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#5f5f5f", marginBottom: 12 } }, "INCIDENT LOG"),
    React.createElement("h2", { style: { fontSize: 34, fontWeight: 600, color: "#fff", letterSpacing: "-0.03em", marginBottom: 8 } }, "Logged Incidents"),
    React.createElement("p", { style: { fontSize: 15, color: "#8e9192", marginBottom: 40, maxWidth: 520, lineHeight: 1.6 } }, "Every incident triaged by Alex is recorded here with its severity, status, and full recovery plan. Click any incident to expand its plan."),
    error ? React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#8e9192", padding: 24, border: "1px solid #262626", borderRadius: 4 } }, "Backend offline - start the server to view incidents.") :
    tickets === null ? React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#5f5f5f" } }, "Loading incidents...") :
    tickets.length === 0 ? React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#5f5f5f", padding: 24, border: "1px solid #1c1c1c", borderRadius: 4 } }, "No incidents logged yet. Report one in the Console.") :
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
      tickets.map((t) => React.createElement(IncidentCard, { key: t.id, t: t }))
    )
  );
}

// ============ PLAYBOOKS VIEW ============
function PlaybooksView() {
  const playbooks = [
    { p: "P1", label: "CRITICAL", sla: "15 minutes", desc: "Active, high-impact incidents threatening critical systems or data. Full IR team activation.", steps: ["Isolate affected systems immediately", "Notify CISO and leadership", "Activate incident response team", "Preserve forensic evidence"] },
    { p: "P2", label: "HIGH", sla: "1 hour", desc: "Serious incidents with significant potential impact. Rapid containment required.", steps: ["Assess scope of impact", "Notify team lead", "Begin containment procedures", "Document all findings"] },
    { p: "P3", label: "MEDIUM", sla: "4 hours", desc: "Moderate incidents handled in the standard analyst queue.", steps: ["Log and monitor", "Assign to queue", "Apply available mitigations"] },
    { p: "P4", label: "LOW", sla: "24 hours", desc: "Low-impact events tracked for routine investigation.", steps: ["Log for tracking", "Schedule routine investigation"] },
  ];
  return React.createElement("div", { className: "alex-scroll", style: { flex: 1, overflowY: "auto", padding: "60px 40px", maxWidth: 1040, width: "100%", margin: "0 auto", animation: "alexFadeIn 0.5s ease" } },
    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#5f5f5f", marginBottom: 12 } }, "RESPONSE PROTOCOLS"),
    React.createElement("h2", { style: { fontSize: 34, fontWeight: 600, color: "#fff", letterSpacing: "-0.03em", marginBottom: 8 } }, "Triage Playbooks"),
    React.createElement("p", { style: { fontSize: 15, color: "#8e9192", marginBottom: 40, maxWidth: 560, lineHeight: 1.6 } }, "Severity classification follows the NIST incident response framework. Each priority carries a defined service-level agreement and response sequence."),
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } },
      playbooks.map((pb) => React.createElement("div", { key: pb.p, style: { background: "#0a0a0d", border: "1px solid #262626", borderRadius: 4, padding: "24px 28px" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
          React.createElement(PriorityChip, { priority: pb.p }),
          React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.1em", color: "#8e9192" } }, "SLA: " + pb.sla)
        ),
        React.createElement("p", { style: { fontSize: 15, color: "#c4c7c8", lineHeight: 1.6, marginBottom: 18 } }, pb.desc),
        React.createElement("div", { style: { borderTop: "1px solid #1c1c1c", paddingTop: 16 } },
          pb.steps.map((s, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 12, padding: "5px 0", fontSize: 14, color: "#c4c7c8" } },
            React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", color: "#5f5f5f", fontSize: 12, minWidth: 18 } }, "0" + (i + 1)),
            React.createElement("span", null, annotateJargon(s))
          ))
        )
      ))
    )
  );
}

// ============ ABOUT / HOW IT WORKS VIEW ============
function AboutView() {
  const steps = [
    { n: "01", t: "Report", d: "An analyst describes a security incident in plain language - what happened, which systems, when it started." },
    { n: "02", t: "Assess", d: "Alex gathers only the essentials, then classifies severity from P1 to P4 using the NIST framework. No endless questions." },
    { n: "03", t: "Plan", d: "Alex immediately builds a structured response plan: containment, investigation, recovery, and who to notify." },
    { n: "04", t: "Act", d: "A ticket is logged automatically. For critical incidents, Alex recommends escalation to an on-call analyst - with human sign-off for anything that disrupts production." },
  ];
  return React.createElement("div", { className: "alex-scroll", style: { flex: 1, overflowY: "auto", padding: "60px 40px", maxWidth: 880, width: "100%", margin: "0 auto", animation: "alexFadeIn 0.5s ease" } },
    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#5f5f5f", marginBottom: 12 } }, "ABOUT ALEX"),
    React.createElement("h2", { style: { fontSize: 40, fontWeight: 600, color: "#fff", letterSpacing: "-0.03em", marginBottom: 20, lineHeight: 1.15 } }, "A calm expert in the first ten minutes of a crisis."),
    React.createElement("p", { style: { fontSize: 17, color: "#c4c7c8", lineHeight: 1.7, marginBottom: 16 } }, "When a security incident hits, the first minutes are the messiest. Alarms fire, people panic, and the right next step is rarely obvious. Alex is an AI security analyst built to bring order to that moment."),
    React.createElement("p", { style: { fontSize: 17, color: "#c4c7c8", lineHeight: 1.7, marginBottom: 48 } }, "Built on the Napster Omniagent platform, Alex listens, triages, and acts - turning a chaotic report into a clear severity rating, a structured response plan, and a logged incident, all in under a minute. It is decisive, not interrogative: it gathers what it needs and commits to a recommendation, while keeping a human in control of anything irreversible."),
    React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.15em", color: "#5f5f5f", marginBottom: 24 } }, "HOW IT WORKS"),
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 48 } },
      steps.map((s) => React.createElement("div", { key: s.n, style: { display: "flex", gap: 24, padding: "24px 0", borderTop: "1px solid #1c1c1c" } },
        React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#5f5f5f", minWidth: 32 } }, s.n),
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: 20, fontWeight: 500, color: "#fff", marginBottom: 8 } }, s.t),
          React.createElement("div", { style: { fontSize: 15, color: "#8e9192", lineHeight: 1.6, maxWidth: 600 } }, s.d)
        )
      ))
    ),
    React.createElement("div", { style: { borderTop: "1px solid #1c1c1c", paddingTop: 32, display: "flex", gap: 40, flexWrap: "wrap" } },
      [["NIST", "Incident framework"], ["P1-P4", "Severity model"], ["< 60s", "Alert to action"], ["Human", "In the loop"]].map((x, i) =>
        React.createElement("div", { key: i },
          React.createElement("div", { style: { fontSize: 26, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" } }, x[0]),
          React.createElement("div", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.08em", color: "#5f5f5f", marginTop: 4 } }, x[1])
        )
      )
    )
  );
}

// ============ ROOT APP WITH NAV ============
const NAV = [
  { key: "console", label: "Console" },
  { key: "incidents", label: "Incidents" },
  { key: "playbooks", label: "Playbooks" },
  { key: "about", label: "About" },
];

export default function App() {
  const [view, setView] = useState("console");
  const [memOpen, setMemOpen] = useState(false);
  const [memKey, setMemKey] = useState(0);
  const openMemory = () => { setMemKey((k) => k + 1); setMemOpen(true); };

  return React.createElement("div", { style: { minHeight: "100vh", height: "100vh", background: "#000", fontFamily: "'Hanken Grotesk', sans-serif", color: "#e2e2e2", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" } },
    React.createElement("style", null, CSS),
    React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: GRAIN } }),
    React.createElement("div", { style: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 130%, rgba(255,255,255,0.05) 0%, transparent 55%)" } }),

    // Nav
    React.createElement("nav", { style: { position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid #1c1c1c", flexShrink: 0 } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flex: 1 } },
        React.createElement("span", { style: { width: 24, height: 24, display: "flex" } }, SHIELD),
        React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: "0.22em", color: "#fff", fontWeight: 500 } }, "ALEX")
      ),
      React.createElement("div", { style: { display: "flex", gap: 36, flex: 1, justifyContent: "center" } },
        NAV.map((n) => React.createElement("a", { key: n.key, href: "#", onClick: (e) => { e.preventDefault(); setView(n.key); }, className: "alex-link" + (view === n.key ? " active" : ""), style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.1em", color: view === n.key ? "#fff" : "#5f5f5f", textDecoration: "none", textTransform: "uppercase" } }, n.label))
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", flex: 1 } },
        React.createElement("button", { onClick: () => setView("console"), className: "alex-chip", style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "#fff", textTransform: "uppercase", border: "1px solid #fff", borderRadius: 9999, padding: "9px 18px", background: "transparent", cursor: "pointer", transition: "all 0.3s" } }, "Start Session")
      )
    ),

    // Ambient corner readouts
    React.createElement("div", { style: { position: "fixed", top: 78, left: 40, zIndex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "#262626" } }, "THREAT FEED: LIVE"),
    React.createElement("div", { style: { position: "fixed", top: 78, right: 40, zIndex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: "#262626" } }, "LATENCY 42ms"),

    // Active view
    React.createElement("div", { style: { flex: 1, position: "relative", zIndex: 2, overflow: "hidden", display: "flex", flexDirection: "column" } },
      view === "console" ? React.createElement(ConsoleView, { onOpenMemory: openMemory }) :
      view === "incidents" ? React.createElement(IncidentsView) :
      view === "playbooks" ? React.createElement(PlaybooksView) :
      React.createElement(AboutView)
    ),

    // Memory drawer
    React.createElement(MemoryDrawer, { open: memOpen, onClose: () => setMemOpen(false), refreshKey: memKey })
  );
}
