const API_BASE = "https://companion-api.napster.com/public";
const API_KEY = process.env.NAPSTER_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL;
const TOOL_SECRET = process.env.TOOL_SECRET;

console.log("🚀 Starting setup...");
console.log("API_KEY:", API_KEY ? "found" : "MISSING");
console.log("BACKEND_URL:", BACKEND_URL || "MISSING");
console.log("TOOL_SECRET:", TOOL_SECRET ? "found" : "MISSING");

if (!API_KEY) { console.error("❌ Missing NAPSTER_API_KEY"); process.exit(1); }
if (!BACKEND_URL) { console.error("❌ Missing BACKEND_URL"); process.exit(1); }
if (!TOOL_SECRET) { console.error("❌ Missing TOOL_SECRET"); process.exit(1); }

const headers = {
  "X-Api-Key": API_KEY,
  "Content-Type": "application/json",
};

async function napsterPost(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${endpoint} failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function createCompanion() {
  console.log("\n📌 Step 1: Creating companion...");
  const companion = await napsterPost("/companions", {
    firstName: "Alex",
    lastName: "Mercer",
    description: `You are Alex, a senior SOC analyst with 10+ years in incident response.
Your role: guide users through structured security incident triage.
Personality: calm, methodical, precise. Ask ONE question at a time.

Your process:
1. Greet and ask them to describe the incident
2. Ask what systems are affected and how many
3. Ask when it was first noticed and if it is still ongoing
4. Ask what indicators they have seen
5. Ask what actions they have already taken
6. Classify severity P1-P4 and summarise
7. Create a ticket, offer escalation if P1 or P2

Follow the NIST Incident Response framework at all times.`,
    gender: "male",
  });
  console.log(`✅ Companion created: ${companion.id}`);
  return companion.id;
}

async function createTools() {
  console.log("\n📌 Step 2: Creating 3 tools...");
  const toolHeaders = { "x-tool-secret": TOOL_SECRET };

  const classifyTool = await napsterPost("/functions", {
    data: {
      name: "classify_incident",
      description: "Classify the severity of a security incident after gathering all information from the user",
      parameters: {
        type: "object",
        properties: {
          incident_type: { type: "string", description: "Type of incident e.g. phishing, ransomware, data breach, DDoS" },
          affected_systems: { type: "string", description: "Which systems are affected and how many" },
          business_impact: { type: "string", enum: ["none", "low", "medium", "high", "critical"] },
          is_ongoing: { type: "boolean", description: "Is the incident currently ongoing" },
          user_summary: { type: "string", description: "Brief summary of what the user reported" },
        },
        required: ["incident_type", "affected_systems", "business_impact", "is_ongoing", "user_summary"],
      },
    },
    flow: "explicit",
    url: `${BACKEND_URL}/tools/classify`,
    headers: toolHeaders,
    prompt: `Only call this after you have ALL of: incident type, affected systems, whether ongoing, and actions taken. Say "Let me assess the severity based on what you have described." before calling.`,
  });
  console.log(`  ✅ classify_incident: ${classifyTool.id}`);

  const ticketTool = await napsterPost("/functions", {
    data: {
      name: "create_ticket",
      description: "Create an incident ticket in the SOC system",
      parameters: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["P1", "P2", "P3", "P4"] },
          incident_type: { type: "string" },
          summary: { type: "string" },
          affected_systems: { type: "string" },
          timeline: { type: "string" },
          actions_taken: { type: "string" },
        },
        required: ["priority", "incident_type", "summary", "affected_systems"],
      },
    },
    flow: "explicit",
    url: `${BACKEND_URL}/tools/create-ticket`,
    headers: toolHeaders,
    prompt: `Call immediately after classify_incident returns a priority. Say "I am creating an incident ticket now." before calling.`,
  });
  console.log(`  ✅ create_ticket: ${ticketTool.id}`);

  const escalateTool = await napsterPost("/functions", {
    data: {
      name: "escalate_to_human",
      description: "Escalate to a human SOC analyst for P1 or P2 incidents only",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          priority: { type: "string", enum: ["P1", "P2"] },
          reason: { type: "string" },
        },
        required: ["ticket_id", "priority", "reason"],
      },
    },
    flow: "explicit",
    url: `${BACKEND_URL}/tools/escalate`,
    headers: toolHeaders,
    prompt: `Only call for P1 or P2 after create_ticket has a ticket_id. Ask the user first: "Would you like me to escalate this to an on-call analyst?" Only proceed if they say yes.`,
  });
  console.log(`  ✅ escalate_to_human: ${escalateTool.id}`);

  return [classifyTool.id, ticketTool.id, escalateTool.id];
}

async function createKnowledge() {
  console.log("\n📌 Step 3: Creating knowledge base...");
  const kb = await napsterPost("/knowledge-bases", {
    name: "SOC Triage Playbook",
    provider: "azureOpenAI",
  });
  console.log(`  ✅ Knowledge base: ${kb.id}`);
  try {
    const file = await napsterPost(`/knowledge-bases/${kb.id}/files`, {
      url: "https://www.cisa.gov/sites/default/files/publications/Federal_Government_Cybersecurity_Incident_and_Vulnerability_Response_Playbooks_508C.pdf",
    });
    console.log(`  ✅ Playbook uploaded: ${file.id}`);
  } catch (e) {
    console.warn(`  ⚠️  Playbook upload skipped: ${e.message}`);
  }
  return kb.id;
}

async function createAgent(companionId, toolIds, kbId) {
  console.log("\n📌 Step 4: Creating Omniagent...");
  const agent = await napsterPost("/agents", {
    companionId,
    name: "SOC Triage Assistant",
    voiceId: "alloy",
    language: "English",
    functions: toolIds,
    knowledgeBaseId: kbId,
    providerSettings: { temperature: 0.3 },
  });
  console.log(`✅ Agent created: ${agent.id}`);
  return agent.id;
}

async function main() {
  console.log("============================");
  try {
    const companionId = await createCompanion();
    const toolIds = await createTools();
    const kbId = await createKnowledge();
    const agentId = await createAgent(companionId, toolIds, kbId);

    console.log("\n============================");
    console.log("✅ DONE — Add this to your .env:");
    console.log("============================");
    console.log(`AGENT_ID=${agentId}`);
  } catch (err) {
    console.error("\n❌ Failed:", err.message);
    process.exit(1);
  }
}

main();