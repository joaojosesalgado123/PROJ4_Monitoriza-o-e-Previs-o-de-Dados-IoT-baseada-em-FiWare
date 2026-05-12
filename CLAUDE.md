# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IoT monitoring and predictive analytics system for textile machines. Combines real-time monitoring via FIWARE (Orion Context Broker) with LSTM-based energy consumption forecasting. Everything runs in Docker.

## Commands

- `docker compose up -d --build` — start all services
- `docker logs -f iot-agent` — watch agent
- `docker logs -f lstm` — watch LSTM training
- `docker compose down` — stop (keeps data)
- `docker compose down -v` — stop and delete all data
- `docker compose restart iot-agent` — restart one service
- `docker compose up -d --build backend` — rebuild one service

## Service URLs

- Admin Panel: http://localhost:5174
- Grafana: http://localhost:3000 (admin/admin)
- CrateDB: http://localhost:4200
- Orion: http://localhost:1026
- Admin API: http://localhost:5000/api
- QuantumLeap: http://localhost:8668

## Architecture

agent.py sends readings to Orion (NGSI-v2). Orion notifies QuantumLeap via subscription. QuantumLeap persists to CrateDB. lstm.py reads history from CrateDB, trains LSTM, writes predictions back. Grafana visualizes both. Admin API/Frontend manage machines and config.

All services share the `fiware` Docker network. See `docker-compose.yml`.

## Key Files

- **agent/agent.py** — simulates 3 textile machines, NGSI-v2 to Orion every 30s
- **lstm/lstm.py** — trains LSTM every 5 min, needs 70+ readings per machine
- **admin/backend/api.py** — Flask REST API on port 5000
- **admin/frontend/src/App.jsx** — React/Vite frontend on port 5174 (será substituído pelo Next.js do Pedro)
- **admin/backend/machines.json** — shared config (machines + send_interval)
- **grafana/dashboards/textile.json** — exported dashboard

## Data Model

**Orion entities** (TextileMachine, Fiware-Service: textile, Fiware-Servicepath: /factory):
- energy_consumed (kWh), thread_remaining (m), error_code (0/101/202/303/404), error_description, status (running|warning|error), machineType (Fiação|Tecelagem|Tingimento), timestamp

**CrateDB tables** (auto-created by QuantumLeap):
- mttextile.ettextilemachine — readings
- mttextile.lstm_predictions — predictions with confidence bounds

## Environment Variables

Set in docker-compose.yml (no .env needed):
- ORION_HOST=orion, ORION_PORT=1026
- CRATE_HOST=crate:4200
- MACHINES_FILE=/config/machines.json
- RUN_INTERVAL=300 (LSTM)

## Trabalho em curso

A integrar o frontend Next.js do Pedro (branch `pedro/frontend`) no lugar do Vite atual. Plano detalhado em `HANDOFF_INTEGRACAO_FRONTEND.md`. Contexto geral em `CONTEXTO_PROJETO4.txt`.