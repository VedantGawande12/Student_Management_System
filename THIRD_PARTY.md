# Third-Party Libraries & Dependencies

This repository leverages the following open-source libraries, frameworks, and design tools:

## 1. Backend (Python 3.10+)
- **Google OR-Tools (`ortools` v9.15+)**:
  - **Purpose:** Deterministic CP-SAT constraint programming solver (`ortools.sat.python.cp_model`) powering the 4-stage engine (base timetable, midsem exams, Spectra week bookings, and minimal-perturbation disruption rescheduler).
  - **License:** Apache 2.0.
- **FastAPI (`fastapi` v0.115+)**:
  - **Purpose:** Asynchronous REST API framework providing fast request validation, dependency-injected RBAC, and OpenAPI documentation.
  - **License:** MIT.
- **Uvicorn (`uvicorn` v0.34+)**:
  - **Purpose:** Production ASGI web server for running the FastAPI backend.
  - **License:** BSD 3-Clause.
- **Pydantic (`pydantic` v2.10+)**:
  - **Purpose:** Strict request/response data validation and settings management using Python type hints.
  - **License:** MIT.
- **HTTPX (`httpx` v0.28+)**:
  - **Purpose:** Async HTTP client for optional external LLM completions and FastAPI test client.
  - **License:** BSD 3-Clause.
- **Supabase Python Client (`supabase` v2.13+)**:
  - **Purpose:** Python SDK connecting with Supabase PostgreSQL for cloud persistence and audit logging.
  - **License:** MIT.
- **Python-dotenv (`python-dotenv` v1.0+)**:
  - **Purpose:** Loading `.env` file into process environment for local development.
  - **License:** BSD 3-Clause.

---

## 2. Frontend (React 18 / Next.js + TypeScript + Tailwind)
- **React (`react`, `react-dom` v18.3+)**:
  - **Purpose:** Modern component-based declarative user interface following strict headless UI separation.
  - **License:** MIT.
- **Vite (`vite` v5.4+)**:
  - **Purpose:** Next-generation frontend build tooling and fast dev server with API proxying.
  - **License:** MIT.
- **Tailwind CSS (`tailwindcss` v3.4+)**:
  - **Purpose:** Utility-first CSS styling for clean, responsive, and accessible presentation.
  - **License:** MIT.
- **TypeScript (`typescript` v5.6+)**:
  - **Purpose:** Static type checking and interface contracts across the headless core.
  - **License:** Apache 2.0.
- **Lucide React (`lucide-react` v0.469+)**:
  - **Purpose:** Clean, accessible SVG iconography.
  - **License:** ISC.
- **Hallmark Design Skill (`Nutlope/hallmark`)**:
  - **Purpose:** Professional typography, visual hierarchy, split-screen institutional layout, and color palette guidance.
  - **Source:** https://github.com/Nutlope/hallmark
