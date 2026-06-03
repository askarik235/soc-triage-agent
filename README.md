# SOC Triage Assistant

An AI security analyst that handles the messy first ten minutes of a cyber incident.

When something goes wrong - ransomware, a phishing wave, a stolen login - the first few minutes are chaos. Alarms fire, people panic, and nobody's sure what to do first. This tool fixes that. You describe what happened in plain English, and "Alex" (the agent) figures out how bad it is, builds a response plan, opens a ticket, and tells you exactly what to do - usually in under a minute.

Built on the Napster Omniagent API for the Omniagent Hackathon.

---

## What it does

You talk to Alex like you'd talk to a senior analyst sitting next to you:

1. You report an incident ("we got hit with ransomware on 3 servers")
2. Alex asks a couple of sharp questions - what's affected, is it still happening - and that's it, no endless interrogation
3. He classifies the severity from P1 (critical) to P4 (low) using the NIST incident response framework
4. He immediately builds a full response plan: how to contain it, how to investigate, how to recover, and who to tell
5. He logs a ticket automatically
6. For serious incidents (P1/P2) he offers to escalate to an on-call human - but anything that would disrupt production needs a human to sign off first

The whole thing is built to be **decisive, not annoying**. It commits to a recommendation instead of asking twenty questions, while keeping a human in control of the irreversible stuff.

---

## How we used the Napster Omniagent API

This is the core of the project - it leans on the platform heavily:

- **Companion** - Alex is a persistent companion with a defined personality and a senior-analyst system prompt
- **4 custom tools** (all `explicit` flow, calling our own backend):
  - `classify_incident` - works out the P1–P4 severity
  - `generate_action_plan` - builds the containment/investigation/recovery/notify plan
  - `create_ticket` - logs the incident
  - `escalate_to_human` - escalates P1/P2 to an on-call analyst
- **Knowledge base** - the agent is backed by the CISA federal incident-response playbook
- **WebSocket sessions** - real-time text chat over the Omniagent WebSocket channel
- **Cross-session memory** - sessions are keyed by `externalClientId`, and the app also feeds Alex a summary of past incidents on connect so he can recall them

---

## The interface

It's a single-page app with four views, all in a dark "command deck" style:

- **Console** - the live chat with Alex. Severity shows as a glowing chip, the response plan renders as collapsible cards, and any security jargon has a hover-over plain-English definition (handy for junior analysts).
- **Incidents** - every incident Alex has logged, pulled live from the backend. Click any one to expand its full recovery plan.
- **Playbooks** - the P1–P4 response protocols and their SLAs.
- **About** - what the tool is and how it works.

There's also a slide-in **Memory** drawer showing past incidents with a short "what was learned" note on each.

---

## How it's built

Four moving parts:

```
Browser (React UI)
      |  WebSocket
      v
Napster Omniagent (cloud)  =  Alex's brain
      |  calls tools over HTTPS (via ngrok in dev)
      v
Node backend (server.js)   =  tool logic + ticket store
```

- **Frontend** - React + Vite. No router; views are switched with simple state.
- **Backend** - plain Node `http` server (no framework). Handles the four tool endpoints, mints WebSocket sessions, and stores tickets.
- **ngrok** - exposes the local backend so Napster's cloud can reach the tool endpoints during development.
- **Storage** - tickets are saved to a JSON file on disk, so they survive a restart.

---

## The tools in detail

**`classify_incident`** - takes incident type, affected systems, business impact, and whether it's ongoing. Returns a P1–P4 priority and the matching SLA.

**`generate_action_plan`** - takes the incident type and priority. Returns a structured plan with four parts: containment, investigation, recovery, and who to notify. The plan is deterministic, so the same incident always produces the same plan.

**`create_ticket`** - takes the priority, summary, and details. Creates a ticket with an ID, SLA deadline, and the full recovery plan attached. Saved to disk.

**`escalate_to_human`** - P1/P2 only, and only after the user agrees. Marks the ticket escalated and assigns an on-call analyst.

---

## Running it locally

You need Node 18+, a Napster Omniagent API key, and ngrok.

**1. Install**
```bash
cd frontend && npm install && cd ..
npm install dotenv
```

**2. Set up your environment.** Create a `.env` in the project root:
```
NAPSTER_API_KEY=your_key_here
AGENT_ID=your_agent_id
TOOL_SECRET=any_random_string
CLIENT_KEY=any_random_string
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```
And a `frontend/.env`:
```
VITE_CLIENT_KEY=same_value_as_CLIENT_KEY_above
```
(The two client keys must match, or the frontend gets blocked.)

**3. Create the Napster resources** (once only):
```bash
node scripts/setup-agent.js
```
This creates the companion, tools, knowledge base, and agent, then prints your `AGENT_ID` - put it in `.env`.

**4. Run all three pieces** (three terminals):
```bash
# 1 - tunnel
ngrok http 3001

# 2 - backend
node backend/server.js

# 3 - frontend
cd frontend && npm run dev
```

Open the localhost URL Vite prints (usually `http://localhost:5173`).

---

## Security

The backend is hardened, not a toy:

- Secrets live in `.env` (gitignored), never in code or the command line
- Tool endpoints require a shared secret (`x-tool-secret`) that only Napster's calls carry
- The session, tickets, and memory endpoints require a client key (`x-client-key`)
- CORS is locked to the frontend origin
- Rate limiting on every endpoint (and tighter on session creation)
- Error messages are sanitized - no internal details leak to the client

**Known item:** there's a moderate advisory in the Vite dev-server toolchain (esbuild, GHSA-67mh-4wv8-2f99). It only affects the local dev server, not a production build, so it's left as-is rather than forcing a breaking Vite upgrade before the deadline.

---

## Common issues

**"Missing required env vars"** - your `.env` isn't being read. Check it's in the project root and `dotenv` is installed.

**Frontend gets 401 / "Backend offline"** - `CLIENT_KEY` and `VITE_CLIENT_KEY` don't match. Make them identical and restart both.

**Tools not firing** - ngrok isn't running, or the tools point at an old ngrok URL. Restart ngrok with your static domain.

**Chat disconnects after a minute** - Napster closes idle sessions by default. The app sends a keepalive and disables the idle timeout to prevent this.

---

## Built with AI assistance

This project was built with help from an AI assistant for coding, debugging, and design, with all architecture and product decisions driven and directed by me.