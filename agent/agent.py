import os
import time
import random
import logging
import requests
from datetime import datetime, timezone
import json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

# --- Configuração ---
ORION_HOST = os.getenv("ORION_HOST", "localhost")
ORION_PORT = os.getenv("ORION_PORT", "1026")
ORION_URL  = f"http://{ORION_HOST}:{ORION_PORT}"
MACHINES_FILE = os.getenv("MACHINES_FILE", "/config/machines.json")

def load_config():
    """Carrega as máquinas e configuração do ficheiro JSON."""
    try:
        with open(MACHINES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data["machines"], data["config"]["send_interval"]
    except Exception as e:
        log.error(f"Erro ao carregar configuração: {e}")
        return [], 30

FIWARE_SERVICE      = "textile"
FIWARE_SERVICE_PATH = "/factory"

HEADERS = {
    "Content-Type": "application/json",
    "Fiware-Service": FIWARE_SERVICE,
    "Fiware-Servicepath": FIWARE_SERVICE_PATH,
}

# Códigos de erro possíveis por tipo de máquina
ERROR_CODES_BY_TYPE = {
    "Fiação": {
        0:   "OK",
        101: "Tensão de fio fora do intervalo",
        202: "Quebra de fio detetada",
        303: "Bobine quase vazia",
        404: "Sensor de fio sem sinal",
    },
    "Tecelagem": {
        0:   "OK",
        101: "Tear bloqueado",
        202: "Tensão de trama incorreta",
        303: "Fio de trama partido",
        404: "Sensor de tear sem sinal",
    },
    "Tingimento": {
        0:   "OK",
        101: "Temperatura do banho fora do intervalo",
        202: "Nível de corante baixo",
        303: "Bomba de circulação com falha",
        404: "Sensor de temperatura sem sinal",
    },
}


# Dados simulados

def simulate_reading(machine: dict) -> dict:
    """Gera uma leitura realista para uma máquina, incluindo consumos específicos por tipo."""
    mid   = machine["id"]
    mtype = machine.get("type", "")
    state = machine_state[mid]

    # Energia consumida neste ciclo (variação ±15%)
    delta_energy = machine["base_energy"] * random.uniform(0.85, 1.15)

    # Fio consumido neste ciclo
    thread_consumed = random.uniform(18, 35)
    state["thread_remaining"] = max(0, state["thread_remaining"] - thread_consumed)
    fio_baixo = state["thread_remaining"] < 100

    if fio_baixo:
        log.info(f"[{machine['name']}] Reabastecimento de fio.")
        state["thread_remaining"] = machine["base_thread"] * random.uniform(0.9, 1.0)

    state["total_energy"] += delta_energy

    # Erro aleatório (5%)
    if random.random() < 0.05:
        machine_errors = [e for e in ERROR_CODES_BY_TYPE.get(mtype, {}).keys() if e != 0]
        state["error_code"] = random.choice(machine_errors) if machine_errors else 0
        state["status"] = "error"
    elif fio_baixo:
        state["error_code"] = 303
        state["status"] = "warning"
    else:
        state["error_code"] = 0
        state["status"] = "running"

    reading = {
        "energy_consumed":   round(delta_energy, 3),
        "thread_remaining":  round(state["thread_remaining"], 1),
        "error_code":        state["error_code"],
        "error_description": ERROR_CODES_BY_TYPE.get(mtype, {}).get(state["error_code"], "Desconhecido"),
        "status":            state["status"],
        "timestamp":         datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
    }

    # ── Consumos específicos por tipo de máquina ─────────────────────────────
    if mtype == "Tingimento":
        # Água consumida por ciclo (litros) e nível de corante (%)
        reading["water_consumption"] = round(random.uniform(50, 200), 1)
        state["chemical_level"] = max(0, state.get("chemical_level", 100) - random.uniform(0.5, 2.0))
        if state["chemical_level"] < 10:
            state["chemical_level"] = 100.0   # reabastecimento
        reading["chemical_level"] = round(state["chemical_level"], 1)

    elif mtype in ("Fiação", "Tecelagem"):
        # Ar comprimido consumido (m³/h)
        reading["compressed_air"] = round(random.uniform(0.3, 1.5), 2)

    return reading


# Comunicação com o Orion

def entity_exists(entity_id: str) -> bool:
    url = f"{ORION_URL}/v2/entities/{entity_id}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=5)
        return r.status_code == 200
    except requests.RequestException:
        return False


def _type_attrs(machine: dict, reading: dict) -> dict:
    """Devolve os atributos NGSI específicos por tipo de máquina."""
    mtype = machine.get("type", "")
    attrs = {}
    if mtype == "Tingimento":
        if "water_consumption" in reading:
            attrs["water_consumption"] = {"type": "Number", "value": reading["water_consumption"],
                                           "metadata": {"unit": {"type": "Text", "value": "L"}}}
        if "chemical_level" in reading:
            attrs["chemical_level"] = {"type": "Number", "value": reading["chemical_level"],
                                        "metadata": {"unit": {"type": "Text", "value": "%"}}}
    elif mtype in ("Fiação", "Tecelagem"):
        if "compressed_air" in reading:
            attrs["compressed_air"] = {"type": "Number", "value": reading["compressed_air"],
                                        "metadata": {"unit": {"type": "Text", "value": "m3/h"}}}
    return attrs


def create_entity(machine: dict, reading: dict):
    url  = f"{ORION_URL}/v2/entities"
    body = {
        "id":   machine["id"],
        "type": "TextileMachine",
        "name":            {"type": "Text",     "value": machine["name"]},
        "machineType":     {"type": "Text",     "value": machine["type"]},
        "energy_consumed": {"type": "Number",   "value": reading["energy_consumed"],
                            "metadata": {"unit": {"type": "Text", "value": "kWh"}}},
        "thread_remaining":{"type": "Number",   "value": reading["thread_remaining"],
                            "metadata": {"unit": {"type": "Text", "value": "meters"}}},
        "error_code":      {"type": "Integer",  "value": reading["error_code"]},
        "error_description":{"type": "Text",    "value": reading["error_description"]},
        "status":          {"type": "Text",     "value": reading["status"]},
        "timestamp":       {"type": "DateTime", "value": reading["timestamp"]},
    }
    body.update(_type_attrs(machine, reading))
    r = requests.post(url, json=body, headers=HEADERS, timeout=5)
    if r.status_code == 201:
        log.info(f"Entidade criada: {machine['id']}")
    elif r.status_code == 422:
        log.info(f"Entidade ja existe, a atualizar: {machine['id']}")
        return "exists"
    else:
        log.error(f"Erro ao criar entidade {machine['id']}: {r.status_code} {r.text}")


def update_entity(machine: dict, reading: dict):
    url  = f"{ORION_URL}/v2/entities/{machine['id']}/attrs"
    body = {
        "energy_consumed":   {"type": "Number",   "value": reading["energy_consumed"]},
        "thread_remaining":  {"type": "Number",   "value": reading["thread_remaining"]},
        "error_code":        {"type": "Integer",  "value": reading["error_code"]},
        "error_description": {"type": "Text",     "value": reading["error_description"]},
        "status":            {"type": "Text",     "value": reading["status"]},
        "timestamp":         {"type": "DateTime", "value": reading["timestamp"]},
        "machineType":       {"type": "Text",     "value": machine["type"]},
    }
    body.update(_type_attrs(machine, reading))
    r = requests.put(url, json=body, headers=HEADERS, timeout=5)
    if r.status_code == 204:
        extras = ""
        if "water_consumption" in reading:
            extras = f" | water={reading['water_consumption']}L chem={reading.get('chemical_level','?')}%"
        elif "compressed_air" in reading:
            extras = f" | air={reading['compressed_air']}m³/h"
        log.info(
            f"[{machine['name']}] energy={reading['energy_consumed']} kWh | "
            f"thread={reading['thread_remaining']} m | "
            f"error={reading['error_code']} | status={reading['status']}{extras}"
        )
    else:
        log.error(f"Erro ao atualizar {machine['id']}: {r.status_code} {r.text}")


def send_reading(machine: dict):
    """Envia leitura para o Orion, a não ser que a máquina esteja pausada."""
    if machine.get("paused", False):
        log.info(f"[{machine['name']}] pausada — a saltar envio.")
        return

    reading = simulate_reading(machine)
    if entity_exists(machine["id"]):
        update_entity(machine, reading)
    else:
        result = create_entity(machine, reading)
        if result == "exists":
            update_entity(machine, reading)


# Setup inicial: subscrição Orion → QuantumLeap

def setup_subscription():
    url = f"{ORION_URL}/v2/subscriptions"
    existing = requests.get(url, headers=HEADERS, timeout=5)
    if existing.status_code == 200 and len(existing.json()) > 0:
        log.info("Subscrição QuantumLeap já existe, a saltar criação.")
        return

    body = {
        "description": "Notificar QuantumLeap de todas as atualizações TextileMachine",
        "subject": {
            "entities": [{"idPattern": ".*", "type": "TextileMachine"}],
            "condition": {
                "attrs": ["energy_consumed", "thread_remaining", "error_code",
                          "error_description", "status", "machineType",
                          "water_consumption", "chemical_level", "compressed_air"]
            },
        },
        "notification": {
            "http": {"url": "http://quantumleap:8668/v2/notify"},
            "attrs": ["energy_consumed", "thread_remaining", "error_code", "error_description",
                      "status", "timestamp", "machineType",
                      "water_consumption", "chemical_level", "compressed_air"],
            "metadata": ["dateCreated", "dateModified"],
        },
        "throttling": 0,
    }

    r = requests.post(url, json=body, headers=HEADERS, timeout=5)
    if r.status_code == 201:
        log.info("Subscrição Orion→QuantumLeap criada com sucesso.")
    else:
        log.error(f"Erro ao criar subscrição: {r.status_code} {r.text}")


# Arranque

def wait_for_orion(retries: int = 20, delay: int = 5):
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(f"{ORION_URL}/version", timeout=5)
            if r.status_code == 200:
                log.info("Orion disponível.")
                return
        except requests.RequestException:
            pass
        log.info(f"A aguardar Orion... ({attempt}/{retries})")
        time.sleep(delay)
    raise RuntimeError("Orion não ficou disponível a tempo.")

machine_state = {}


def main():
    log.info(" IoT Agent a iniciar ")
    wait_for_orion()
    setup_subscription()

    while True:
        machines, send_interval = load_config()
        log.info(f"Orion: {ORION_URL} | Intervalo: {send_interval}s | Máquinas: {len(machines)}")

        for machine in machines:
            if machine["id"] not in machine_state:
                machine_state[machine["id"]] = {
                    "thread_remaining": machine["base_thread"],
                    "total_energy":     0.0,
                    "error_code":       0,
                    "status":           "running",
                    "chemical_level":   100.0,
                }
            try:
                send_reading(machine)
            except Exception as e:
                log.error(f"Erro inesperado em {machine['id']}: {e}")

        time.sleep(send_interval)


if __name__ == "__main__":
    main()
