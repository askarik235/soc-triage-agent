import { useState, useEffect, useRef, useCallback } from "react";
const BACKEND_URL = "http://localhost:3001";
const CLIENT_KEY = import.meta.env.VITE_CLIENT_KEY || "";
export function useOmniagent({ userId, onStatusChange }) {
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const manualClose = useRef(false);
  const updateStatus = useCallback((s) => { setStatus(s); onStatusChange && onStatusChange(s); }, [onStatusChange]);
  const addMessage = useCallback((role, text) => { setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]); }, []);
  const handleEvent = useCallback((event) => {
    const type = event.event || event.type;
    const d = event.data || {};
    const inner = d.message || d;
    const role = inner.role || d.role;
    const action = inner.action || d.action;
    const content = inner.content || d.content;
    if (type === "message_received" && action === "completed" && content) {
      if (role === "assistant") addMessage("agent", content);
      else if (role === "user") addMessage("user", content);
    }
    if (type === "session.ended" || type === "disconnected") updateStatus("idle");
  }, [addMessage, updateStatus]);
  const startPing = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    pingRef.current = setInterval(() => { if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { try { wsRef.current.send(JSON.stringify({ type: "ping" })); } catch (e) {} } }, 25000);
  }, []);
  // Fetch past incidents and feed them to Alex as silent context so he can recall them.
  const injectMemory = useCallback(async () => {
    try {
      const res = await fetch(BACKEND_URL + "/memory/" + (userId || "analyst-001"), { headers: { "x-client-key": CLIENT_KEY } });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.memory || [];
      if (!items.length) return;
      const lines = items.slice(0, 10).map((t) => "- " + t.id + " (" + t.priority + ", " + t.incident_type + "): " + t.summary + (t.status ? " [" + t.status + "]" : ""));
      const summary = "MEMORY - Past incidents you have already handled for this analyst. You DO remember these. If asked about a past incident, reference the matching one by its ID and details:\n" + lines.join("\n");
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "send_message", data: { role: "system", text: summary, trigger_response: false, delay: false } }));
      }
    } catch (e) { /* memory injection is best-effort */ }
  }, [userId]);
  const doConnect = useCallback(async () => {
    try {
      updateStatus("connecting");
      const res = await fetch(BACKEND_URL + "/api/session", { method: "POST", headers: { "Content-Type": "application/json", "x-client-key": CLIENT_KEY }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error("Session failed: " + res.status);
      const data = await res.json();
      const decoded = JSON.parse(atob(data.token));
      let wsUrl = decoded.url;
      if (wsUrl.startsWith("https://")) wsUrl = wsUrl.replace("https://", "wss://");
      if (wsUrl.startsWith("http://")) wsUrl = wsUrl.replace("http://", "ws://");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.addEventListener("open", () => { updateStatus("connected"); addMessage("system", "Connected. Describe your incident."); startPing(); setTimeout(() => injectMemory(), 600); });
      ws.addEventListener("message", (e) => { try { handleEvent(JSON.parse(e.data)); } catch (err) { console.error("Parse error:", err); } });
      ws.addEventListener("close", () => { wsRef.current = null; if (pingRef.current) clearInterval(pingRef.current); if (!manualClose.current) { updateStatus("connecting"); setTimeout(() => { if (!manualClose.current) doConnect(); }, 1500); } else { updateStatus("idle"); } });
      ws.addEventListener("error", () => { updateStatus("error"); });
    } catch (err) { console.error(err); updateStatus("error"); addMessage("system", "Connection failed: " + err.message); }
  }, [userId, updateStatus, addMessage, handleEvent, startPing, injectMemory]);
  const connect = useCallback(() => { if (wsRef.current) return; manualClose.current = false; doConnect(); }, [doConnect]);
  const disconnect = useCallback(() => { manualClose.current = true; if (pingRef.current) clearInterval(pingRef.current); if (wsRef.current) wsRef.current.close(); wsRef.current = null; updateStatus("idle"); }, [updateStatus]);
  const sendMessage = useCallback((text) => { if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false; wsRef.current.send(JSON.stringify({ type: "send_message", data: { role: "user", text: text, trigger_response: true, delay: false } })); return true; }, []);
  useEffect(() => { return () => { manualClose.current = true; if (pingRef.current) clearInterval(pingRef.current); if (wsRef.current) wsRef.current.close(); }; }, []);
  return { status, messages, connect, disconnect, sendMessage, isConnected: status === "connected" };
}
