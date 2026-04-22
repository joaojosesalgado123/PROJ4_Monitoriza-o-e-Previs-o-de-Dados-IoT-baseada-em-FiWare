import json
import os
import logging
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from urllib.parse import quote


logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

MACHINES_FILE = os.getenv("MACHINES_FILE", "machines.json")
ORION_URL = f"http://{os.getenv('ORION_HOST', 'orion')}:{os.getenv('ORION_PORT', '1026')}"

FIWARE_SERVICE = "textile"
FIWARE_SERVICE_PATH = "/factory"

FIWARE_HEADERS = {
    "Content-Type": "application/json",
    "Fiware-Service": FIWARE_SERVICE,
    "Fiware-ServicePath": FIWARE_SERVICE_PATH,
}

FIWARE_GET_HEADERS = {
    "Fiware-Service": FIWARE_SERVICE,
    "Fiware-ServicePath": FIWARE_SERVICE_PATH,
}

MACHINE_TYPES = ["Fiação", "Tecelagem", "Tingimento"]


def load_machines():
    with open(MACHINES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_machines(data):
    with open(MACHINES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# --- Rotas ---

@app.route("/api/machines", methods=["GET"])
def get_machines():
    data = load_machines()

    machines = data["machines"]

    # Enriquecer com estado atual do Orion
    for machine in machines:
        try:
            r = requests.get(
                f"{ORION_URL}/v2/entities/{quote(machine['id'], safe='')}",
                headers=FIWARE_GET_HEADERS,
                timeout=3
            )
            if r.status_code == 200:
                entity = r.json()
                machine["status"] = entity.get("status", {}).get("value", "unknown")
                machine["error_code"] = entity.get("error_code", {}).get("value", 0)
                machine["error_description"] = entity.get("error_description", {}).get("value", "OK")
                machine["energy_consumed"] = entity.get("energy_consumed", {}).get("value", 0)
                machine["thread_remaining"] = entity.get("thread_remaining", {}).get("value", 0)
                machine["online"] = True
            else:
                machine["online"] = False
                machine["status"] = "offline"
        except Exception as e:
            log.error(f"DEBUG EXCEPTION: {machine['id']} -> {e}")
            machine["online"] = False
            machine["status"] = "offline"

    return jsonify(machines)


@app.route("/api/machines", methods=["POST"])
def add_machine():
    data = load_machines()
    body = request.get_json()

    # Validação
    required = ["name", "type", "base_energy", "base_thread"]
    for field in required:
        if field not in body:
            return jsonify({"error": f"Campo obrigatório em falta: {field}"}), 400

    if body["type"] not in MACHINE_TYPES:
        return jsonify({"error": f"Tipo inválido. Tipos válidos: {MACHINE_TYPES}"}), 400

    # Gerar ID sequencial
    existing_ids = [int(m["id"].split(":")[-1]) for m in data["machines"]]
    new_number = max(existing_ids) + 1 if existing_ids else 1
    new_id = f"urn:ngsi-ld:TextileMachine:{new_number:03d}"

    new_machine = {
        "id": new_id,
        "name": body["name"],
        "type": body["type"],
        "base_energy": float(body["base_energy"]),
        "base_thread": float(body["base_thread"])
    }

    data["machines"].append(new_machine)
    save_machines(data)

    log.info(f"Máquina adicionada: {new_id}")
    return jsonify(new_machine), 201


@app.route("/api/machines/<machine_id>", methods=["DELETE"])
def remove_machine(machine_id):
    data = load_machines()
    full_id = f"urn:ngsi-ld:TextileMachine:{machine_id}"

    machines = [m for m in data["machines"] if m["id"] != full_id]
    if len(machines) == len(data["machines"]):
        return jsonify({"error": "Máquina não encontrada"}), 404

    data["machines"] = machines
    save_machines(data)

    # Remover do Orion
    try:
        requests.delete(
            f"{ORION_URL}/v2/entities/{full_id}",
            headers=FIWARE_HEADERS,
            timeout=3
        )
    except Exception as e:
        log.warning(f"Erro ao remover do Orion: {e}")

    log.info(f"Máquina removida: {full_id}")
    return jsonify({"message": "Máquina removida com sucesso"}), 200


@app.route("/api/config", methods=["GET"])
def get_config():
    data = load_machines()
    return jsonify(data["config"])


@app.route("/api/config", methods=["PUT"])
def update_config():
    data = load_machines()
    body = request.get_json()

    if "send_interval" in body:
        interval = int(body["send_interval"])
        if interval < 5:
            return jsonify({"error": "Intervalo mínimo é 5 segundos"}), 400
        data["config"]["send_interval"] = interval
        save_machines(data)
        log.info(f"Intervalo atualizado para {interval}s")

    return jsonify(data["config"])


@app.route("/api/types", methods=["GET"])
def get_types():
    return jsonify(MACHINE_TYPES)


if __name__ == "__main__":
    # Copiar machines.json para o volume se não existir
    if not os.path.exists(MACHINES_FILE):
        import shutil

        os.makedirs(os.path.dirname(MACHINES_FILE), exist_ok=True)
        shutil.copy("machines.json", MACHINES_FILE)
        log.info(f"machines.json copiado para {MACHINES_FILE}")

    app.run(host="0.0.0.0", port=5000, debug=False)