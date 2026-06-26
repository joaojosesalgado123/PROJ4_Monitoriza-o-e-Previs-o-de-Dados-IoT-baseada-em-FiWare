# Monitorização IoT - Máquinas Têxteis (FiWare)

## Estrutura do projeto

```
projeto/
├── docker-compose.yml          # Stack completa
├── agent/
│   ├── agent.py                # Simulador IoT (3 máquinas)
│   ├── Dockerfile
│   └── requirements.txt
└── grafana/
    └── provisioning/
        └── datasources/
            └── crate.yml       # Ligação automática ao CrateDB
```

## Arranque rápido

```bash
# 1. Clonar / copiar os ficheiros para a tua máquina
# 2. Subir toda a stack
docker compose up -d --build

# Ver logs do agente
docker logs -f iot-agent
```

## Serviços e portas

| Serviço       | URL                          | Descrição                        |
|---------------|------------------------------|----------------------------------|
| Orion         | http://localhost:1026        | Context Broker NGSI-v2           |
| QuantumLeap   | http://localhost:8668        | Persistência timeseries          |
| CrateDB UI    | http://localhost:4200        | Console SQL da base de dados     |
| Grafana       | http://localhost:3000        | Dashboard (admin / admin)        |

## Verificar dados no Orion

```bash
# Listar entidades das máquinas
curl -H "Fiware-Service: textile" \
     -H "Fiware-Servicepath: /factory" \
     "http://localhost:1026/v2/entities?type=TextileMachine" | python -m json.tool

# Ver uma máquina específica
curl -H "Fiware-Service: textile" \
     -H "Fiware-Servicepath: /factory" \
     http://localhost:1026/v2/entities/urn:ngsi-ld:TextileMachine:001 | python -m json.tool
```

## Verificar dados históricos no QuantumLeap

```bash
# Histórico de energia da máquina 001 (últimas 10 leituras)
curl "http://localhost:8668/v2/entities/urn:ngsi-ld:TextileMachine:001/attrs/energy_consumed?lastN=10" \
     -H "Fiware-Service: textile" \
     -H "Fiware-Servicepath: /factory" | python -m json.tool
```

## Consultar dados no CrateDB (SQL)

Acede a http://localhost:4200 e executa:

```sql
-- Ver tabela gerada automaticamente pelo QuantumLeap
SELECT * FROM doc.ettextilemachine ORDER BY time_index DESC LIMIT 20;

-- Energia média por máquina
SELECT entity_id, AVG(energy_consumed) as avg_energy
FROM doc.ettextilemachine
GROUP BY entity_id;

-- Série temporal de fio restante
SELECT time_index, entity_id, thread_remaining
FROM doc.ettextilemachine
ORDER BY time_index DESC
LIMIT 50;
```

## Grafana

### Exemplo de query para Grafana (série temporal de energia):

```sql
SELECT
  time_index AS "time",
  energy_consumed,
  entity_id
FROM doc.ettextilemachine
WHERE $__timeFilter(time_index)
ORDER BY time_index ASC
```

## Adicionar mais máquinas

Esta secção está desatualizada — as máquinas já não se adicionam editando uma lista `MACHINES` no `agent.py`. Hoje há duas formas:

**1. Pela interface (recomendado):** botão "Adicionar máquina" no admin (canto superior direito, só visível para admin). Pede nome, tipo (Fiação/Tecelagem/Tingimento), consumo base (kW), fio na bobine cheia (m) e, dependendo do tipo, água base (L, Tingimento) ou ar comprimido base (m³/h, Fiação/Tecelagem). Isto chama `POST /api/machines` no backend, que regista a máquina em `machines.json` com um ID sequencial automático. O `agent.py` relê esse ficheiro a cada ciclo, por isso a máquina nova começa a enviar telemetria sem precisar de reiniciar nada.

**2. Editando `admin/backend/machines.json` diretamente:**
```json
{
  "id": "urn:ngsi-ld:TextileMachine:004",
  "name": "Máquina D",
  "type": "Fiação",
  "base_energy": 5.5,
  "base_thread": 850.0,
  "base_air": 0.9
}
```
(usa `"base_water"` em vez de `"base_air"` se `"type"` for `"Tingimento"`). Não é preciso reiniciar nenhum container — tanto o `iot-agent` como o backend reler o ficheiro periodicamente.

## Dados simulados por cada máquina

| Atributo           | Tipo    | Descrição                          |
|--------------------|---------|-------------------------------------|
| `energy_consumed`  | Number  | kWh consumidos no ciclo (±15% var) |
| `thread_remaining` | Number  | Metros de fio restantes            |
| `error_code`       | Integer | 0=OK, 101/202/303/404=erro         |
| `status`           | Text    | "running" ou "error"               |
| `timestamp`        | DateTime| Timestamp UTC da leitura           |

Os erros ocorrem com 5% de probabilidade. O fio é reabastecido automaticamente quando fica abaixo de 100 metros.
