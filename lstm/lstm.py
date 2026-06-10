import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import warnings
warnings.filterwarnings('ignore')

import time
import numpy as np
import pandas as pd
from crate import client
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, Input
from sqlalchemy import create_engine
import tensorflow as tf

tf.config.optimizer.set_experimental_options({'disable_meta_optimizer': True})

# CONFIGURAÇÕES
CRATE_HOST = os.getenv("CRATE_HOST", "crate:4200")
SCHEMA_TABLE = "mttextile.ettextilemachine"
MACHINE_IDS = [
    "urn:ngsi-ld:TextileMachine:001",
    "urn:ngsi-ld:TextileMachine:002",
    "urn:ngsi-ld:TextileMachine:003"
]
WINDOW_SIZE = 60
RUN_INTERVAL = int(os.getenv("RUN_INTERVAL", "300"))  # corre a cada 5 minutos
FORECAST_STEPS = 6   # 6 × 5 min = 30 min de previsão
STEP_MINUTES   = 5


# EXTRAÇÃO DE DADOS (CRATEDB)

def fetch_data(machine_id):
    print(f"\n--- A ligar ao CrateDB e extrair histórico da {machine_id} ---")
    engine = create_engine(f"crate://{CRATE_HOST}")

    query = f"""
        SELECT time_index, energy_consumed, thread_remaining, error_code, machinetype
        FROM {SCHEMA_TABLE}
        WHERE entity_id = '{machine_id}'
        ORDER BY time_index ASC
    """
    df = pd.read_sql(query, engine)
    engine.dispose()
    df = df.ffill()
    return df


# PREPARAÇÃO DOS DADOS

def prepare_data(df):
    print("A normalizar e preparar janelas de tempo...")
    features = ['energy_consumed', 'thread_remaining', 'error_code']
    data = df[features].values

    energy_scaler = MinMaxScaler(feature_range=(0, 1))
    energy_scaler.fit(df[['energy_consumed']])

    scaler = MinMaxScaler(feature_range=(0, 1))
    data_scaled = scaler.fit_transform(data)

    X, y = [], []
    for i in range(WINDOW_SIZE, len(data_scaled)):
        X.append(data_scaled[i-WINDOW_SIZE:i, :])
        y.append(data_scaled[i, 0])

    return np.array(X), np.array(y), scaler, energy_scaler, data_scaled


# CONSTRUÇÃO E TREINO DO MODELO LSTM

def build_and_train_model(X, y):
    print(f"A treinar modelo LSTM com {len(X)} amostras...")
    model = Sequential()
    model.add(Input(shape=(X.shape[1], X.shape[2])))
    model.add(LSTM(units=50, return_sequences=False))
    model.add(Dropout(0.2))
    model.add(Dense(units=1))
    model.compile(optimizer='adam', loss='mean_squared_error')
    model.fit(X, y, epochs=20, batch_size=32, validation_split=0.2, verbose=1)
    return model


# PREVISÃO DOS PRÓXIMOS 30 MINUTOS

def predict_future(model, data_scaled, energy_scaler, machine_id, machine_type):
    """Gera FORECAST_STEPS previsões iterativas (cada uma avança 5 min)."""
    window = data_scaled[-WINDOW_SIZE:].copy()
    step_results = []  # (step_num, energy_kWh, energy_scaled)

    for step in range(1, FORECAST_STEPS + 1):
        input_seq = np.array([window])
        pred_scaled = model.predict(input_seq, verbose=0)
        pred_energy = float(energy_scaler.inverse_transform(pred_scaled)[0][0])
        step_results.append((step, pred_energy, float(pred_scaled[0][0])))

        # Avançar a janela: último valor substituído pela previsão
        new_row = window[-1].copy()
        new_row[0] = pred_scaled[0][0]
        window = np.vstack([window[1:], new_row])

    # Margem calculada com base no erro histórico do modelo
    margin = calculate_error_margin(
        machine_id, step_results[0][1], energy_scaler, model, data_scaled
    )

    print("\n" + "=" * 60)
    print(f"PREVISÃO 30 MIN: {machine_id}")
    for step, energy, _ in step_results:
        print(f"  +{step * STEP_MINUTES}min: {energy:.2f} kWh  (±{margin:.2f})")
    print("=" * 60 + "\n")

    save_predictions_multi(machine_id, machine_type, step_results, margin)
    return [r[1] for r in step_results]


def calculate_error_margin(machine_id, predicted_energy, energy_scaler, model, data_scaled):
    """Calcula a margem de erro com base no erro histórico do modelo."""
    try:
        errors = []
        check_points = min(10, len(data_scaled) - WINDOW_SIZE)
        for i in range(check_points):
            idx = len(data_scaled) - WINDOW_SIZE - check_points + i
            window = np.array([data_scaled[idx:idx + WINDOW_SIZE]])
            pred_scaled = model.predict(window, verbose=0)
            pred = float(energy_scaler.inverse_transform(pred_scaled)[0][0])
            real = float(energy_scaler.inverse_transform([[data_scaled[idx + WINDOW_SIZE][0]]])[0][0])
            errors.append(abs(pred - real))
        margin = float(np.mean(errors)) if errors else predicted_energy * 0.1
        return round(margin, 3)
    except Exception as e:
        print(f"Erro ao calcular margem: {e}")
        return round(predicted_energy * 0.1, 3)


def save_predictions_multi(machine_id, machine_type, step_results, margin):
    """Guarda 6 previsões com timestamps futuros no CrateDB."""
    try:
        conn = client.connect([CRATE_HOST])
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mttextile.lstm_predictions (
                time_index TIMESTAMP,
                entity_id TEXT,
                machinetype TEXT,
                predicted_energy DOUBLE,
                predicted_energy_min DOUBLE,
                predicted_energy_max DOUBLE
            )
        """)

        # Remover previsões anteriores desta máquina
        cursor.execute(
            "DELETE FROM mttextile.lstm_predictions WHERE entity_id = ?",
            (machine_id,)
        )

        now_ms = int(time.time() * 1000)
        for step, pred_energy, _ in step_results:
            future_ms = now_ms + step * STEP_MINUTES * 60 * 1000
            cursor.execute("""
                INSERT INTO mttextile.lstm_predictions
                (time_index, entity_id, machinetype, predicted_energy, predicted_energy_min, predicted_energy_max)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                future_ms,
                machine_id,
                machine_type,
                pred_energy,
                pred_energy - margin,
                pred_energy + margin,
            ))

        conn.close()
        print(f"{FORECAST_STEPS} previsões guardadas no CrateDB para {machine_id}")
    except Exception as e:
        print(f"Erro ao guardar previsões: {e}")


# LOOP PRINCIPAL

def run_cycle():
    print("\n========== NOVO CICLO LSTM ==========")
    for machine in MACHINE_IDS:
        df = fetch_data(machine)
        if len(df) < WINDOW_SIZE + 10:
            print(f"[{machine}] Dados insuficientes ({len(df)} leituras). Mínimo: {WINDOW_SIZE + 10}. A aguardar...")
        else:
            X, y, scaler, energy_scaler, data_scaled = prepare_data(df)
            model = build_and_train_model(X, y)
            machine_type = df['machinetype'].iloc[-1] if 'machinetype' in df.columns else "Desconhecido"
            predict_future(model, data_scaled, energy_scaler, machine, machine_type)
            print(f"Processo concluído para {machine}.\n")


def wait_for_crate(retries=20, delay=10):
    """Aguarda o CrateDB estar disponível."""
    import requests
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(f"http://{CRATE_HOST}", timeout=5)
            if r.status_code == 200:
                print("CrateDB disponível.")
                return
        except Exception:
            pass
        print(f"A aguardar CrateDB... ({attempt}/{retries})")
        time.sleep(delay)
    raise RuntimeError("CrateDB não ficou disponível a tempo.")


if __name__ == "__main__":
    print("LSTM Service a iniciar...")
    wait_for_crate()
    while True:
        try:
            run_cycle()
        except Exception as e:
            print(f"Erro no ciclo LSTM: {e}")
        print(f"Próximo ciclo em {RUN_INTERVAL} segundos...")
        time.sleep(RUN_INTERVAL)
