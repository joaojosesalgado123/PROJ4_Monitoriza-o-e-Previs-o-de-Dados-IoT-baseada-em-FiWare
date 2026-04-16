import os
import time
import random
import logging
import requests
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

# --- Configuração ---
ORION_HOST = os.getenv("ORION_HOST", "localhost")
ORION_PORT = os.getenv("ORION_PORT", "1026")
ORION_URL  = f"http://{ORION_HOST}:{ORION_PORT}"
SEND_INTERVAL = int(os.getenv("SEND_INTERVAL", "30"))  # 30 em 30 segundos a gerar dados

# Fiware-Service e Fiware-ServicePath (short context / multitenancy)
FIWARE_SERVICE      = "textile"
FIWARE_SERVICE_PATH = "/factory"

HEADERS = {
    "Content-Type": "application/json",
    "Fiware-Service": FIWARE_SERVICE,
    "Fiware-Servicepath": FIWARE_SERVICE_PATH,
}

# --- Máquinas ---
MACHINES = [
    {
        "id": "urn:ngsi-ld:TextileMachine:001",
        "name": "Máquina A",
        "base_energy": 5.2,    
        "base_thread": 800.0,  
    },
    {
        "id": "urn:ngsi-ld:TextileMachine:002",
        "name": "Máquina B",
        "base_energy": 4.8,
        "base_thread": 950.0,
    },
    {
        "id": "urn:ngsi-ld:TextileMachine:003",
        "name": "Máquina C",
        "base_energy": 6.1,
        "base_thread": 750.0,
    },
]

# Códigos de erro possíveis
ERROR_CODES = {
    0:   "OK",
    101: "Tensão de fio fora do intervalo",
    202: "Temperatura do motor elevada",
    303: "Quebra de fio detetada",
    404: "Sensor de fio sem sinal",
}

# Estado interno de cada máquina 
machine_state = {
    m["id"]: {
        "thread_remaining": m["base_thread"],
        "total_energy":     0.0,
        "error_code":       0,
        "status":           "running",
    }
    for m in MACHINES
}

# Dados simulados

def simulate_reading(machine: dict) -> dict:
    """Gera uma leitura realista para uma máquina."""
    mid   = machine["id"]
    state = machine_state[mid]

    # Energia consumida neste ciclo (com variação 15%)
    delta_energy = machine["base_energy"] * random.uniform(0.85, 1.15)

    # Fio consumido neste ciclo 
    thread_consumed = random.uniform(18, 35)
    state["thread_remaining"] = max(0, state["thread_remaining"] - thread_consumed)

    # Repor fio quando ficar baixo 
    if state["thread_remaining"] < 100:
        log.info(f"[{machine['name']}] Reabastecimento de fio.")
        state["thread_remaining"] = machine["base_thread"] * random.uniform(0.9, 1.0)

    state["total_energy"] += delta_energy

    # Erro aleatório (5% de probabilidade)
    if random.random() < 0.05:
        state["error_code"] = random.choice([101, 202, 303, 404])
        state["status"] = "error"
    else:
        state["error_code"] = 0
        state["status"] = "running"

    return {
        "energy_consumed":  round(delta_energy, 3),       
        "thread_remaining": round(state["thread_remaining"], 1), 
        "error_code":       state["error_code"],
        "status":           state["status"],
        "timestamp":        datetime.utcnow().isoformat() + "Z",
    }


# Comunicação com o Orion

def entity_exists(entity_id: str) -> bool:
    """Verifica se a entidade já existe no Orion."""
    url = f"{ORION_URL}/v2/entities/{entity_id}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=5)
        return r.status_code == 200
    except requests.RequestException:
        return False


def create_entity(machine: dict, reading: dict):
    """Cria a entidade NGSI-v2 no Orion (primeira vez)."""
    url  = f"{ORION_URL}/v2/entities"
    body = {
        "id":   machine["id"],
        "type": "TextileMachine",
        "name": {
            "type":  "Text",
            "value": machine["name"],
        },
        "energy_consumed": {
            "type":  "Number",
            "value": reading["energy_consumed"],
            "metadata": {"unit": {"type": "Text", "value": "kWh"}},
        },
        "thread_remaining": {
            "type":  "Number",
            "value": reading["thread_remaining"],
            "metadata": {"unit": {"type": "Text", "value": "meters"}},
        },
        "error_code": {
            "type":  "Integer",
            "value": reading["error_code"],
        },
        "status": {
            "type":  "Text",
            "value": reading["status"],
        },
        "timestamp": {
            "type":  "DateTime",
            "value": reading["timestamp"],
        },
    }
    r = requests.post(url, json=body, headers=HEADERS, timeout=5)
    if r.status_code == 201:
        log.info(f"Entidade criada: {machine['id']}")
    elif r.status_code == 422:
        log.info(f"Entidade ja existe, a atualizar: {machine['id']}")
        return "exists"
    else:
        log.error(f"Erro ao criar entidade {machine['id']}: {r.status_code} {r.text}")


def update_entity(machine: dict, reading: dict):
    """Atualiza os atributos da entidade existente via PATCH."""
    url  = f"{ORION_URL}/v2/entities/{machine['id']}/attrs"
    body = {
        "energy_consumed":  {"type": "Number",   "value": reading["energy_consumed"]},
        "thread_remaining": {"type": "Number",   "value": reading["thread_remaining"]},
        "error_code":       {"type": "Integer",  "value": reading["error_code"]},
        "status":           {"type": "Text",     "value": reading["status"]},
        "timestamp":        {"type": "DateTime", "value": reading["timestamp"]},
    }
    r = requests.patch(url, json=body, headers=HEADERS, timeout=5)
    if r.status_code == 204:
        log.info(
            f"[{machine['name']}] energy={reading['energy_consumed']} kWh | "
            f"thread={reading['thread_remaining']} m | "
            f"error={reading['error_code']} | status={reading['status']}"
        )
    else:
        log.error(f"Erro ao atualizar {machine['id']}: {r.status_code} {r.text}")


def send_reading(machine: dict):
    """Cria ou atualiza a entidade no Orion."""
    reading = simulate_reading(machine)
    if entity_exists(machine["id"]):
        update_entity(machine, reading)
    else:
        result = create_entity(machine, reading)
        # Se já existia, faz update
        if result == "exists":
            update_entity(machine, reading)


# Setup inicial: subscrição Orion → QuantumLeap

def setup_subscription():
    """
    Cria uma subscrição no Orion para que o QuantumLeap receba automaticamente todas as atualizações das máquinas têxteis.
    """
    url = f"{ORION_URL}/v2/subscriptions"

    # Verifica se já existe subscrição
    existing = requests.get(url, headers=HEADERS, timeout=5)
    if existing.status_code == 200 and len(existing.json()) > 0:
        log.info("Subscrição QuantumLeap já existe, a saltar criação.")
        return

    body = {
        "description": "Notificar QuantumLeap de todas as atualizações TextileMachine",
        "subject": {
            "entities": [{"idPattern": ".*", "type": "TextileMachine"}],
            "condition": {
                "attrs": ["energy_consumed", "thread_remaining", "error_code", "status"]
            },
        },
        "notification": {
            "http": {"url": "http://quantumleap:8668/v2/notify"},
            "attrs": ["energy_consumed", "thread_remaining", "error_code", "status", "timestamp"],
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
    """Aguarda o Orion estar disponível antes de iniciar."""
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


def main():
    log.info(" IoT Agent a iniciar ")
    log.info(f"Orion: {ORION_URL} | Intervalo: {SEND_INTERVAL}s | Máquinas: {len(MACHINES)}")

    wait_for_orion()
    setup_subscription()

    while True:
        for machine in MACHINES:
            try:
                send_reading(machine)
            except Exception as e:
                log.error(f"Erro inesperado em {machine['id']}: {e}")
        time.sleep(SEND_INTERVAL)


if __name__ == "__main__":
    main()