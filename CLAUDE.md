# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ai-solver ("小助来喽") — an OJ auto-solver. A Tampermonkey userscript scrapes problem text from OJ pages (Luogu, EduCoder, etc.), sends it to a local FastAPI backend, which asks GLM-4-flash for C++ code, compiles it locally with `g++`, and retries up to 3 times feeding compiler errors back to the model. The directory is named `autocoder`; the GitHub remote is `ai-solver`.

## Commands

```bash
# Run the backend (entrypoint is app.py, not main.py)
uvicorn app:app --reload                    # default 127.0.0.1:8000

# Local syntax check
python3 -m py_compile app.py && echo "OK"

# Install deps
pip install -r requirements.txt
```

Note: `start.sh` and the README refer to `main:app`/`backend/main.py`, but the actual entrypoint is **`app.py`** (`uvicorn app:app`). There is no test suite.

The frontend is `scripts/userscript.js` — paste it into Tampermonkey. It POSTs to `http://127.0.0.1:8000/solve` via `GM_xmlhttpRequest`, so the local backend must be running.

## Architecture

End-to-end flow: userscript scrapes page → `POST /solve` (SSE) → `self_check_generator` loops up to 3×: stream GLM code → strip ```` ```cpp ```` fences → `check_cpp_compilation` writes `temp.cpp`, runs `g++ -std=c++17` (5s timeout) → on success emit `final` + `save_history`; on failure append the compiler `stderr` as a new user turn and retry. After 3 failures the last candidate is returned anyway.

- **`app.py`** — entire backend.
  - GLM is reached through the **OpenAI SDK** (`AsyncOpenAI`), not the zhipuai SDK, pointed at `base_url="https://open.bigmodel.cn/api/paas/v4/"`. API key from `.env` as `API_KEY`.
  - `/solve` streams SSE event types: `status`, `code_stream`, `final`, `error`. `system_prompt` is an optional request field; falls back to the built-in C++ persona (no comments, `#include<bits/stdc++.h>`).
  - `save_history` appends Q/A to `data/history.md`.
- **`scripts/userscript.js`** — Tampermonkey script (`GM_xmlhttpRequest`, `@connect 127.0.0.1`). Draggable floating button, scrapes problem text, renders the streamed answer.

## Gotchas

- **`onprogress` is unreliable** for the SSE stream in `GM_xmlhttpRequest` — the script falls back to parsing the full response in `onload` (see `userscript.js` ~line 145). Preserve this fallback when editing streaming logic.
- README/`start.sh` say `main.py`/`backend/`; the real file is `app.py` at repo root. Trust the code.
- `g++` must be on PATH for compile-checking to work.
- CORS is `allow_origins=["*"]` (fine for local dev).
