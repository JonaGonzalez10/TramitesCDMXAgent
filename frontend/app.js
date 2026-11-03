const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const sendBtn = document.getElementById("send");
const tabs = document.querySelectorAll(".tab");

const GREETINGS = {
  tramites: "Hola, soy el asistente de trámites de la CDMX. ¿En qué trámite te ayudo?",
  eventos: "Hola, soy el asistente de eventos de la CDMX. ¿Qué tipo de evento buscas?",
};
const TITLES = { tramites: "Trámites CDMX", eventos: "Eventos CDMX" };
const DESCRIPTIONS = {
  tramites: "Requisitos, costos y pasos de trámites de la Ciudad de México.",
  eventos: "Conciertos, exposiciones y actividades en la Ciudad de México.",
};
const PLACEHOLDERS = {
  tramites: "Pregunta sobre un trámite...",
  eventos: "Pregunta sobre eventos...",
};

// Historial y conversación por agente
const state = {};
for (const key of Object.keys(GREETINGS)) {
  state[key] = { conversationId: null, history: [{ text: GREETINGS[key], cls: "bot" }] };
}
let current = "tramites";

// Convierte [texto](url), **negritas** y URLs sueltas en nodos DOM (sin innerHTML).
const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')\]]+)|\*\*([^*]+)\*\*/g;

function renderRich(container, text) {
  container.textContent = "";
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    container.append(text.slice(last, m.index));
    if (m[4] !== undefined) {
      const b = document.createElement("strong");
      b.textContent = m[4];
      container.append(b);
    } else {
      let label = m[1], url = m[2] || m[3];
      if (!m[2]) {
        // quita puntuación final que no es parte de la URL
        const trail = url.match(/[.,;:!?]+$/);
        if (trail) {
          url = url.slice(0, -trail[0].length);
          m.trailing = trail[0];
        }
        label = url;
      }
      const a = document.createElement("a");
      a.href = url;
      a.textContent = label;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      container.append(a);
      if (m.trailing) container.append(m.trailing);
    }
    last = m.index + m[0].length;
  }
  container.append(text.slice(last));
}

function addMessage(text, cls, save = true) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  renderRich(div, text);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  if (save) state[current].history.push({ text, cls });
  return div;
}

function showAgent(key) {
  current = key;
  document.body.dataset.agent = key;
  document.getElementById("agent-title").textContent = TITLES[key];
  document.getElementById("agent-desc").textContent = DESCRIPTIONS[key];
  tabs.forEach((t) => {
    const on = t.dataset.agent === key;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  });
  input.placeholder = PLACEHOLDERS[key];
  messages.textContent = "";
  state[key].history.forEach((m) => addMessage(m.text, m.cls, false));
  input.focus();
}

tabs.forEach((t) => t.addEventListener("click", () => showAgent(t.dataset.agent)));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const agent = current;
  const s = state[agent];
  addMessage(text, "user");
  input.value = "";
  sendBtn.disabled = true;
  const pending = document.createElement("div");
  pending.className = "msg bot";
  pending.textContent = "Escribiendo...";
  messages.appendChild(pending);
  messages.scrollTop = messages.scrollHeight;

  let reply, cls = "bot";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, message: text, conversation_id: s.conversationId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error desconocido");
    s.conversationId = data.conversation_id;
    reply = data.reply;
  } catch (err) {
    reply = err.message;
    cls = "error";
  }
  s.history.push({ text: reply, cls });
  if (current === agent) {
    pending.className = `msg ${cls}`;
    renderRich(pending, reply);
    messages.scrollTop = messages.scrollHeight;
  }
  sendBtn.disabled = false;
  input.focus();
});

showAgent("tramites");
