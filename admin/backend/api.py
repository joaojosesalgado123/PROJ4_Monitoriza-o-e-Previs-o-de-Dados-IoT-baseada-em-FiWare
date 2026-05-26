import json
import os
import logging
import requests
from datetime import datetime, timedelta
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


# --- Helpers CrateDB ---

def crate_query(stmt: str) -> list:
    crate_url = f"http://{os.getenv('CRATE_HOST', 'crate')}:4200/_sql"
    r = requests.post(crate_url, json={"stmt": stmt}, timeout=10)
    r.raise_for_status()
    data = r.json()
    cols = data.get("cols", [])
    rows = data.get("rows", [])
    return [dict(zip(cols, row)) for row in rows]


def short_id_to_urn(short: str) -> str:
    if short.startswith("urn:"):
        return short
    num = short.split("-")[-1].zfill(3)
    return f"urn:ngsi-ld:TextileMachine:{num}"


def urn_to_short(urn: str) -> str:
    return f"M-{urn.split(':')[-1]}"


def minutes_ago_ms(minutes: int) -> int:
    return int((datetime.utcnow() - timedelta(minutes=minutes)).timestamp() * 1000)


def clamp_minutes(raw, default=60, maximum=1440) -> int:
    try:
        v = int(raw) if raw else default
        return max(1, min(v, maximum))
    except (TypeError, ValueError):
        return default


def load_machines():
    with open(MACHINES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_machines(data):
    with open(MACHINES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# --- Rotas CrateDB ---

@app.route("/api/machines/<machine_id>/history", methods=["GET"])
def get_machine_history(machine_id):
    metric = request.args.get("metric", "energy")
    minutes = clamp_minutes(request.args.get("minutes"), default=60)

    urn = short_id_to_urn(machine_id)
    ms = minutes_ago_ms(minutes)

    if metric == "thread":
        col = "thread_remaining"
    else:
        col = "energy_consumed"
        metric = "energy"

    stmt = (
        f"SELECT time_index, MAX({col}) AS value "
        f"FROM mttextile.ettextilemachine "
        f"WHERE entity_id = '{urn}' AND time_index >= {ms} "
        f"GROUP BY time_index "
        f"ORDER BY time_index ASC "
        f"LIMIT 1000"
    )

    try:
        rows = crate_query(stmt)
    except Exception as e:
        log.warning(f"history query failed: {e}")
        return jsonify({"error": str(e)}), 502

    points = [
        {"time": datetime.utcfromtimestamp(r["time_index"] / 1000).isoformat() + "Z", "value": r["value"]}
        for r in rows
    ]

    log.info(f"history {urn} metric={metric} minutes={minutes} -> {len(points)} pts")
    return jsonify({"machine_id": urn_to_short(urn), "metric": metric, "points": points})


@app.route("/api/machines/<machine_id>/predictions", methods=["GET"])
def get_machine_predictions(machine_id):
    minutes = clamp_minutes(request.args.get("minutes"), default=60)
    urn = short_id_to_urn(machine_id)
    ms = minutes_ago_ms(minutes)

    stmt = (
        f"SELECT time_index, predicted_energy, predicted_energy_min, predicted_energy_max "
        f"FROM mttextile.lstm_predictions "
        f"WHERE entity_id = '{urn}' AND time_index >= {ms} "
        f"ORDER BY time_index ASC"
    )

    try:
        rows = crate_query(stmt)
    except Exception as e:
        log.warning(f"predictions query failed: {e}")
        return jsonify({"error": str(e)}), 502

    points = [
        {
            "time": datetime.utcfromtimestamp(r["time_index"] / 1000).isoformat() + "Z",
            "value": r["predicted_energy"],
            "min": r["predicted_energy_min"],
            "max": r["predicted_energy_max"],
        }
        for r in rows
    ]

    log.info(f"predictions {urn} minutes={minutes} -> {len(points)} pts")
    return jsonify({"machine_id": urn_to_short(urn), "points": points})


@app.route("/api/alerts/errors", methods=["GET"])
def get_alert_errors():
    minutes = clamp_minutes(request.args.get("minutes"), default=60)
    ms = minutes_ago_ms(minutes)

    stmt = (
        f"SELECT error_code, error_description, COUNT(*) AS n "
        f"FROM ("
        f"  SELECT entity_id, time_index, MAX(error_code) AS error_code, MAX(error_description) AS error_description "
        f"  FROM mttextile.ettextilemachine "
        f"  WHERE time_index >= {ms} AND error_code > 0 "
        f"  GROUP BY entity_id, time_index"
        f") AS dedup "
        f"GROUP BY error_code, error_description "
        f"ORDER BY n DESC "
        f"LIMIT 20"
    )

    try:
        rows = crate_query(stmt)
    except Exception as e:
        log.warning(f"errors query failed: {e}")
        return jsonify({"error": str(e)}), 502

    items = [
        {"error_code": r["error_code"], "description": r["error_description"], "count": r["n"]}
        for r in rows
    ]

    log.info(f"alert errors minutes={minutes} -> {len(items)} tipos")
    return jsonify({"items": items})


@app.route("/api/alerts/severity", methods=["GET"])
def get_alert_severity():
    minutes = clamp_minutes(request.args.get("minutes"), default=60)
    bucket_minutes = clamp_minutes(request.args.get("bucket_minutes"), default=5, maximum=60)
    ms = minutes_ago_ms(minutes)

    stmt = (
        f"SELECT DATE_TRUNC('minute', time_index) AS bucket, status, COUNT(*) AS n "
        f"FROM ("
        f"  SELECT entity_id, time_index, MAX(status) AS status "
        f"  FROM mttextile.ettextilemachine "
        f"  WHERE time_index >= {ms} "
        f"  GROUP BY entity_id, time_index"
        f") AS dedup "
        f"GROUP BY bucket, status "
        f"ORDER BY bucket ASC"
    )

    try:
        rows = crate_query(stmt)
    except Exception as e:
        log.warning(f"severity query failed: {e}")
        return jsonify({"error": str(e)}), 502

    # Agrupar em buckets de bucket_minutes minutos
    buckets = {}
    for r in rows:
        # bucket vem em ms epoch
        ts = r["bucket"] / 1000
        # arredondar para baixo ao múltiplo de bucket_minutes
        slot = int(ts // (bucket_minutes * 60)) * (bucket_minutes * 60)
        if slot not in buckets:
            buckets[slot] = {"running": 0, "warning": 0, "error": 0}
        status = (r["status"] or "").lower()
        if status in buckets[slot]:
            buckets[slot][status] += r["n"]

    points = [
        {
            "time": datetime.utcfromtimestamp(slot).isoformat() + "Z",
            "running": counts["running"],
            "warning": counts["warning"],
            "error": counts["error"],
        }
        for slot, counts in sorted(buckets.items())
    ]

    log.info(f"alert severity minutes={minutes} bucket={bucket_minutes}m -> {len(points)} buckets")
    return jsonify({"points": points})


@app.route("/api/alerts/errors-timeline", methods=["GET"])
def get_errors_timeline():
    minutes = clamp_minutes(request.args.get("minutes"), default=60)
    bucket_minutes = clamp_minutes(request.args.get("bucket_minutes"), default=5, maximum=60)
    ms = minutes_ago_ms(minutes)

    # Máquinas conhecidas para garantir que cada bucket tem sempre todas
    data = load_machines()
    known_urns = [m["id"] for m in data["machines"]]

    stmt = (
        f"SELECT entity_id, time_index, MAX(error_code) AS error_code "
        f"FROM mttextile.ettextilemachine "
        f"WHERE time_index >= {ms} AND error_code > 0 "
        f"GROUP BY entity_id, time_index "
        f"ORDER BY time_index ASC"
    )

    try:
        rows = crate_query(stmt)
    except Exception as e:
        log.warning(f"errors-timeline query failed: {e}")
        return jsonify({"error": str(e)}), 502

    # Grelha de slots ancorada ao instante actual
    bucket_sec = bucket_minutes * 60
    slots_count = minutes // bucket_minutes
    now_sec = int(datetime.utcnow().timestamp())
    current_slot = now_sec - (now_sec % bucket_sec)
    first_slot = current_slot - bucket_sec * (slots_count - 1)

    # Agrupar dados em {slot_ts -> {urn -> max_error_code}}
    raw_buckets: dict = {}
    for r in rows:
        ts = r["time_index"] / 1000
        slot = int(ts // bucket_sec) * bucket_sec
        urn = r["entity_id"]
        if slot not in raw_buckets:
            raw_buckets[slot] = {}
        raw_buckets[slot][urn] = max(raw_buckets[slot].get(urn, 0), r["error_code"])

    # Iterar por todos os slots da grelha (completo, sem buracos)
    points = []
    for i in range(slots_count):
        slot = first_slot + i * bucket_sec
        by_machine = [
            {
                "machine_id": urn_to_short(urn),
                "error_code": raw_buckets.get(slot, {}).get(urn, 0),
            }
            for urn in known_urns
        ]
        points.append({
            "time": datetime.utcfromtimestamp(slot).isoformat() + "Z",
            "by_machine": by_machine,
        })

    log.info(f"errors-timeline minutes={minutes} bucket={bucket_minutes}m -> {len(points)} buckets")
    return jsonify({"points": points})


@app.route("/api/kpi/energy-today", methods=["GET"])
def get_energy_today():
    stmt = (
        "SELECT entity_id, SUM(energy_consumed) AS kwh "
        "FROM ("
        "  SELECT entity_id, time_index, MAX(energy_consumed) AS energy_consumed "
        "  FROM mttextile.ettextilemachine "
        "  WHERE time_index >= DATE_TRUNC('day', NOW()) "
        "  GROUP BY entity_id, time_index"
        ") AS dedup "
        "GROUP BY entity_id"
    )

    try:
        rows = crate_query(stmt)
    except Exception as e:
        log.warning(f"energy-today query failed: {e}")
        return jsonify({"error": str(e)}), 502

    by_machine = [
        {"machine_id": urn_to_short(r["entity_id"]), "kwh": round(r["kwh"], 3)}
        for r in rows
    ]
    total_kwh = round(sum(r["kwh"] for r in rows), 3)

    log.info(f"energy-today total={total_kwh} kWh over {len(by_machine)} machines")
    return jsonify({"total_kwh": total_kwh, "by_machine": by_machine})


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
    purge = request.args.get("purge", "false").lower() == "true"

    machines = [m for m in data["machines"] if m["id"] != full_id]
    if len(machines) == len(data["machines"]):
        return jsonify({"error": "Máquina não encontrada"}), 404

    data["machines"] = machines
    save_machines(data)

    # Remover do Orion
    try:
        requests.delete(
            f"{ORION_URL}/v2/entities/{quote(full_id, safe='')}",
            headers=FIWARE_GET_HEADERS,
            timeout=3
        )
    except Exception as e:
        log.warning(f"Erro ao remover do Orion: {e}")

    # Apagar dados históricos do CrateDB se purge=true
    if purge:
        try:
            crate_url = f"http://{os.getenv('CRATE_HOST', 'crate')}:4200/_sql"
            requests.post(crate_url, json={
                "stmt": f"DELETE FROM mttextile.ettextilemachine WHERE entity_id = '{full_id}'"
            }, timeout=5)
            requests.post(crate_url, json={
                "stmt": f"DELETE FROM mttextile.lstm_predictions WHERE entity_id = '{full_id}'"
            }, timeout=5)
            log.info(f"Dados históricos apagados do CrateDB para {full_id}")
        except Exception as e:
            log.warning(f"Erro ao apagar dados do CrateDB: {e}")

    log.info(f"Máquina removida: {full_id} | purge={purge}")
    return jsonify({"message": "Máquina removida com sucesso", "purge": purge}), 200


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