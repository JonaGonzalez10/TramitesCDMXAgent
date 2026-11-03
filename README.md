# Trámites CDMX Agent

Chat (HTML/CSS/JS) + FastAPI que consume un agente de Microsoft Foundry.

## Ejecutar
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # completar valores
uvicorn main:app --reload
```
Abrir http://localhost:8000

Sin claves ni secretos: se usa `DefaultAzureCredential` (`az login` en local).

## Despliegue en Azure App Service
1. Activar **Managed Identity** (system-assigned) en el App Service.
2. En el recurso/proyecto de Foundry, asignarle a esa identidad el rol **Azure AI User**.
3. Comando de inicio (desde la raíz del repo): `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000`.
4. Opcional: app settings `FOUNDRY_PROJECT_ENDPOINT` y `FOUNDRY_AGENT_NAME` (hay valores por defecto no sensibles).
No subas `.env` al repositorio.
