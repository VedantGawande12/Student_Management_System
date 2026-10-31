# Third-Party Libraries & Dependencies

This monorepo leverages open-source and industry-standard tools:

## Backend (Python 3.10+)
- **Google OR-Tools (`ortools` v9.15+)**:
  - Purpose: Deterministic CP-SAT constraint programming solver (`ortools.sat.python.cp_model`) powering the 4-stage engine (base timetable, midsem exams, Spectra week bookings, and minimal-perturbation disruption rescheduler).
  - License: Apache 2.0.
- **FastAPI (`fastapi` v0.141+)**:
  - Purpose: High-performance asynchronous web framework providing REST APIs, multipart file uploads, and OpenAPI documentation.
  - License: MIT.
- **Uvicorn (`uvicorn` v0.52+)**:
  - Purpose: ASGI web server for running the FastAPI application.
  - License: BSD 3-Clause.
- **Pydantic (`pydantic` v2.13+)**:
  - Purpose: Data validation and settings management using Python type hints.
  - License: MIT.
- **HTTPX (`httpx` v0.28+)**:
  - Purpose: Async HTTP client for optional external LLM completions with fallback.
  - License: BSD 3-Clause.

## Frontend (React 18 + TypeScript + Tailwind)
- **React (`react`, `react-dom` v18.3+)**:
  - Purpose: Component-based user interface following strict headless UI separation.
  - License: MIT.
- **Vite (`vite` v5.4+)**:
  - Purpose: Frontend build tooling and fast dev server with API proxying.
  - License: MIT.
- **Tailwind CSS (`tailwindcss` v3.4+)**:
  - Purpose: Utility-first CSS styling for the swappable presentation layer.
  - License: MIT.
- **TypeScript (`typescript` v5.6+)**:
  - Purpose: Static typing and interface contracts across the headless core.
  - License: Apache 2.0.
- **Lucide React (`lucide-react`)**:
  - Purpose: Clean SVG icons.
  - License: ISC.

