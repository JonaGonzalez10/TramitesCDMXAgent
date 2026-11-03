import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

ENDPOINT = os.getenv(
    "FOUNDRY_PROJECT_ENDPOINT",
    "https://jonathangonzalezs-ia-2512-resour.services.ai.azure.com/api/projects/jonathangonzalezs-ia-2512",
)
AGENTS = {
    "tramites": os.getenv("FOUNDRY_AGENT_TRAMITES", os.getenv("FOUNDRY_AGENT_NAME", "Tramites-CDMX-Agent")),
    "eventos": os.getenv("FOUNDRY_AGENT_EVENTOS", "Eventos-CDMX-Agent"),
}

app = FastAPI(title="CDMX Agents")

_project = None
_clients = {}


def get_client(agent_key: str):
    """Cliente OpenAI enlazado al agente indicado (se crea una sola vez por agente)."""
    global _project
    if agent_key not in _clients:
        if _project is None:
            from azure.ai.projects import AIProjectClient
            from azure.identity import DefaultAzureCredential

            _project = AIProjectClient(
                endpoint=ENDPOINT,
                credential=DefaultAzureCredential(),
                allow_preview=True,
            )
        _clients[agent_key] = _project.get_openai_client(agent_name=AGENTS[agent_key])
    return _clients[agent_key]


class ChatRequest(BaseModel):
    agent: Literal["tramites", "eventos"] = "tramites"
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str


DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
CDMX_TZ = timezone(timedelta(hours=-6))  # CDMX no usa horario de verano desde 2022


def date_context() -> str:
    now = datetime.now(CDMX_TZ)
    return (
        f"[Contexto del sistema: hoy es {DIAS[now.weekday()]} {now.day} de {MESES[now.month - 1]} "
        f"de {now.year}, {now:%H:%M} hora de Ciudad de México. Usa esta fecha para interpretar "
        "'hoy', 'mañana', 'este fin de semana' o 'el próximo fin de semana'; no muestres eventos pasados.]"
    )


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        client = get_client(req.agent)
        conv_id = req.conversation_id or client.conversations.create().id
        response = client.responses.create(
            conversation=conv_id,
            input=[{"role": "user", "content": f"{date_context()}\n\n{req.message}"}],
        )
    except Exception as exc:
        raise HTTPException(502, f"Error al consultar el agente: {exc}")
    return ChatResponse(reply=response.output_text, conversation_id=conv_id)


@app.get("/api/health")
def health():
    return {"status": "ok"}


class NoCacheStatic(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", NoCacheStatic(directory=FRONTEND, html=True), name="frontend")
