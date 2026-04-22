import os
import time
import random
import logging
import requests
from datetime import datetime
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

# Fiware-Service e Fiware-ServicePath (short context / multitenancy)
FIWARE_SERVICE      = "textile"
FIWARE_SERVICE_PATH = "/factory"

HEADERS = {
    "Content-Type": "application/json",
    "Fiware-Service": FIWARE_SERVICE,
    "Fiware-Servicepath": FIWARE_SERVICE_PATH,
}



# Códigos de erro possíveis
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
    """Gera uma leitura realista para uma máquina."""
    mid   = machine["id"]
    state = machine_state[mid]

    # Energia consumida neste ciclo (com variação 15%)
    delta_energy = machine["base_energy"] * random.uniform(0.85, 1.15)

    # Fio consumido neste ciclo (proporcional à energia)
    thread_consumed = random.uniform(18, 35)
    state["thread_remaining"] = max(0, state["thread_remaining"] - thread_consumed)

    # Verificar se fio está a acabar ANTES de reabastecer
    fio_baixo = state["thread_remaining"] < 100

    # Repor fio quando ficar baixo
    if fio_baixo:
        log.info(f"[{machine['name']}] Reabastecimento de fio.")
        state["thread_remaining"] = machine["base_thread"] * random.uniform(0.9, 1.0)

    state["total_energy"] += delta_energy

    # Erro aleatório (5% de probabilidade) específico por tipo de máquina
    if random.random() < 0.05:
        machine_errors = list(ERROR_CODES_BY_TYPE.get(machine["type"], {}).keys())
        machine_errors = [e for e in machine_errors if e != 0]
        state["error_code"] = random.choice(machine_errors)
        state["status"] = "error"
    elif fio_baixo:
        state["error_code"] = 303
        state["status"] = "warning"
    else:
        state["error_code"] = 0
        state["status"] = "running"

    return {
        "energy_consumed": round(delta_energy, 3),
        "thread_remaining": round(state["thread_remaining"], 1),
        "error_code": state["error_code"],
        "error_description": ERROR_CODES_BY_TYPE.get(machine["type"], {}).get(state["error_code"], "Desconhecido"),
        "status": state["status"],
        "timestamp": datetime.utcnow().isoformat() + "Z",
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
        "machineType": {
            "type": "Text",
            "value": machine["type"],
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
        "error_description": {
            "type": "Text",
            "value": reading["error_description"],
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
        "error_description": {"type": "Text", "value": reading["error_description"]},
        "status":           {"type": "Text",     "value": reading["status"]},
        "timestamp":        {"type": "DateTime", "value": reading["timestamp"]},
        "machineType":      {"type": "Text", "value": machine["type"]},
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
    Cria uma subscrição no Orion para que o QuantumLeap receba
    automaticamente todas as atualizações das máquinas têxteis.
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
                "attrs": ["energy_consumed", "thread_remaining", "error_code", "error_description", "status", "machineType"]
            },
        },
        "notification": {
            "http": {"url": "http://quantumleap:8668/v2/notify"},
            "attrs": ["energy_consumed", "thread_remaining", "error_code", "error_description", "status", "timestamp", "machineType"],
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

machine_state = {}


def main():
    log.info(" IoT Agent a iniciar ")

    wait_for_orion()
    setup_subscription()

    while True:
        machines, send_interval = load_config()
        log.info(f"Orion: {ORION_URL} | Intervalo: {send_interval}s | Máquinas: {len(machines)}")

        for machine in machines:
            # Inicializar estado se máquina nova
            if machine["id"] not in machine_state:
                machine_state[machine["id"]] = {
                    "thread_remaining": machine["base_thread"],
                    "total_energy": 0.0,
                    "error_code": 0,
                    "status": "running",
                }
            try:
                send_reading(machine)
            except Exception as e:
                log.error(f"Erro inesperado em {machine['id']}: {e}")
        time.sleep(send_interval)




if __name__ == "__main__":
    main()