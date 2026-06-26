import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import warnings
warnings.filterwarnings('ignore')

import json
import time
import numpy as np
import pandas as pd
from crate import client
from sklearn.preprocessing import MinMaxScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, Input
from sqlalchemy import create_engine
import tensorflow as tf

tf.config.optimizer.set_experimental_options({'disable_meta_optimizer': True})

# CONFIGURAÇÕES
CRATE_HOST = os.getenv("CRATE_HOST", "crate:4200")
SCHEMA_TABLE = "mttextile.ettextilemachine"
MACHINES_FILE = os.getenv("MACHINES_FILE", "/config/machines.json")
# Usado apenas se machines.json não estiver acessível (ver load_machine_ids) —
# garante que o serviço continua a funcionar com as 3 máquinas originais.
FALLBACK_MACHINE_IDS = [
    "urn:ngsi-ld:TextileMachine:001",
    "urn:ngsi-ld:TextileMachine:002",
    "urn:ngsi-ld:TextileMachine:003"
]
RUN_INTERVAL = int(os.getenv("RUN_INTERVAL", "300"))  # corre a cada 5 minutos

# Intervalo real entre leituras do agente IoT (machines.json -> config.send_interval).
RAW_READING_INTERVAL_SECONDS = int(os.getenv("READING_INTERVAL_SECONDS", "30"))

# --- Modelo de previsão de energia: 12h de histórico -> 1h de previsão ---
# As leituras em bruto (a cada ~30s) são primeiro agregadas em blocos de
# BUCKET_MINUTES minutos (resample_to_buckets). Cada passo temporal do modelo
# passa a corresponder exatamente a um bloco real, o que torna a janela de
# entrada e o horizonte de previsão diretamente explicáveis em horas.
BUCKET_MINUTES   = 5
HOURS_OF_HISTORY = 12
FORECAST_HOURS   = 1

WINDOW_SIZE    = int(HOURS_OF_HISTORY * 60 / BUCKET_MINUTES)   # 144 blocos = 12h de contexto
STEP_MINUTES   = BUCKET_MINUTES                                  # 1 bloco = 1 passo de previsão
FORECAST_STEPS = int(FORECAST_HOURS * 60 / STEP_MINUTES)         # 12 passos = 1h de previsão

# nº mínimo de blocos (após agregação) para se conseguir formar pelo menos
# algumas amostras de treino (janela + horizonte + margem)
MIN_BUCKETS_FOR_LSTM = WINDOW_SIZE + FORECAST_STEPS + 5
# equivalente em leituras em bruto, só para os logs serem legíveis
MIN_RAW_FOR_LSTM = int(MIN_BUCKETS_FOR_LSTM * BUCKET_MINUTES * 60 / RAW_READING_INTERVAL_SECONDS)

# Fração treino/teste do split cronológico (ver chronological_split)
TRAIN_FRACTION = 0.8

# --- Classificador de risco de falha (regressão logística) ---
# Continua a trabalhar sobre as leituras em bruto (não os blocos de 5 min),
# porque o objetivo aqui é reagir rápido a sinais de erro recentes, não
# previsão de consumo a longo prazo. Fica disponível muito mais cedo que o LSTM.
FAILURE_FEATURE_WINDOW = 10   # leituras em bruto usadas para construir as features
FAILURE_LOOKAHEAD      = 30   # leituras futuras observadas para o rótulo (~15 min a 30s/leitura)
MIN_RAW_FOR_FAILURE    = FAILURE_FEATURE_WINDOW + FAILURE_LOOKAHEAD + 30


# CONFIGURAÇÃO DE MÁQUINAS

def load_machine_ids():
    """Lê machines.json (o mesmo ficheiro usado pelo agent.py e pelo admin/backend)
    e devolve os IDs de todas as máquinas configuradas. Lido a cada ciclo, para que
    máquinas criadas via admin entrem automaticamente no pipeline de previsão e no
    classificador de falha, sem precisar de reiniciar nem alterar código."""
    try:
        with open(MACHINES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        ids = [m["id"] for m in data["machines"]]
        return ids if ids else FALLBACK_MACHINE_IDS
    except Exception as e:
        print(f"Não foi possível ler {MACHINES_FILE} ({e}); a usar a lista por defeito.")
        return FALLBACK_MACHINE_IDS


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

    if len(df):
        ts_col = df["time_index"]
        ts_parsed = (
            pd.to_datetime(ts_col, unit="ms", utc=True)
            if pd.api.types.is_numeric_dtype(ts_col)
            else pd.to_datetime(ts_col, utc=True)
        )
        span_h = (ts_parsed.max() - ts_parsed.min()).total_seconds() / 3600
        print(f"[{machine_id}] diagnóstico: {len(df)} linhas | "
              f"{ts_col.nunique()} timestamps distintos | "
              f"intervalo {ts_parsed.min()} -> {ts_parsed.max()} ({span_h:.1f}h)")

    return df


def resample_to_buckets(df, bucket_minutes=BUCKET_MINUTES):
    """Agrega as leituras em bruto (a cada ~30s) em blocos de `bucket_minutes`
    minutos, para que cada passo temporal do modelo de energia corresponda a um
    bloco real e a janela de 12h caiba em WINDOW_SIZE blocos (em vez de milhares
    de leituras em bruto, o que tornaria o LSTM lento e mais difícil de explicar)."""
    if len(df) == 0:
        return df

    ts_col = df["time_index"]
    if pd.api.types.is_numeric_dtype(ts_col):
        ts = pd.to_datetime(ts_col, unit="ms", utc=True)
    else:
        ts = pd.to_datetime(ts_col, utc=True)

    bucket = ts.dt.floor(f"{bucket_minutes}min")
    grouped = (
        df.assign(_bucket=bucket)
        .groupby("_bucket", as_index=False)
        .agg(
            energy_consumed=("energy_consumed", "mean"),
            thread_remaining=("thread_remaining", "mean"),
            error_code=("error_code", "max"),
            machinetype=("machinetype", "last"),
        )
        .sort_values("_bucket")
        .reset_index(drop=True)
    )
    return grouped.drop(columns="_bucket")


# PREPARAÇÃO DOS DADOS (já em blocos de BUCKET_MINUTES)

def prepare_data(bucketed_df):
    """Constrói janelas de entrada (WINDOW_SIZE blocos = 12h) e os respetivos
    alvos multi-passo: para cada janela, o alvo é um vetor com os FORECAST_STEPS
    valores reais de energy_consumed nos blocos seguintes (1h de previsão)."""
    print(f"A normalizar e preparar janelas de {WINDOW_SIZE} blocos ({HOURS_OF_HISTORY}h) "
          f"-> {FORECAST_STEPS} passos ({FORECAST_HOURS}h de previsão)...")
    features = ['energy_consumed', 'thread_remaining', 'error_code']
    data = bucketed_df[features].values

    energy_scaler = MinMaxScaler(feature_range=(0, 1))
    energy_scaler.fit(bucketed_df[['energy_consumed']])

    scaler = MinMaxScaler(feature_range=(0, 1))
    data_scaled = scaler.fit_transform(data)

    X, y = [], []
    last_i = len(data_scaled) - FORECAST_STEPS  # último i válido (inclusive)
    for i in range(WINDOW_SIZE, last_i + 1):
        X.append(data_scaled[i - WINDOW_SIZE:i, :])
        y.append(data_scaled[i:i + FORECAST_STEPS, 0])

    return np.array(X), np.array(y), scaler, energy_scaler, data_scaled


def chronological_split(X, y, train_fraction=TRAIN_FRACTION):
    """Divide as amostras em treino (80%, mais antigas) e teste (20%, mais
    recentes) SEM baralhar.

    Porquê não baralhar: cada amostra é uma janela deslizante ao longo do tempo
    (avança um bloco de cada vez), por isso amostras vizinhas partilham quase
    todos os pontos entre si — só muda 1 bloco em WINDOW_SIZE. Se baralhásssemos
    antes de dividir, era garantido que janelas quase idênticas acabavam uma no
    treino e outra no teste, e o modelo "via" no teste praticamente os mesmos
    dados em que treinou (fuga de informação). O resultado seria um MAE de teste
    artificialmente bom, que não reflete a capacidade real de generalizar para
    dados futuros nunca vistos. Por isso o split é cronológico: treina-se sempre
    no passado e testa-se sempre no troço mais recente, que o modelo nunca viu.

    Isto é independente da "memória curta" do LSTM em si (que se refere a quão
    para trás, DENTRO de uma janela, a rede consegue propagar informação) — aqui
    a questão é sobre como separar o CONJUNTO de janelas de treino e de teste.
    """
    split_idx = int(len(X) * train_fraction)
    return X[:split_idx], X[split_idx:], y[:split_idx], y[split_idx:]


def evaluate_on_test(model, X_test, y_test, energy_scaler):
    """MAE em kWh reais (desnormalizado) sobre o conjunto de teste — o troço mais
    recente dos dados, nunca usado no treino. É esta métrica que valida o
    desempenho real do modelo (não a loss de treino)."""
    if len(X_test) == 0:
        return None
    pred_scaled = model.predict(X_test, verbose=0)
    pred_kwh = energy_scaler.inverse_transform(pred_scaled.reshape(-1, 1)).reshape(pred_scaled.shape)
    real_kwh = energy_scaler.inverse_transform(y_test.reshape(-1, 1)).reshape(y_test.shape)
    mae = float(np.mean(np.abs(pred_kwh - real_kwh)))
    return round(mae, 3)


# CONSTRUÇÃO E TREINO DO MODELO LSTM

def build_and_train_model(X_train, y_train, X_test, y_test):
    """Modelo com saída direta de FORECAST_STEPS valores (um por cada bloco de
    previsão até 1h), em vez de prever um único passo e realimentá-lo
    recursivamente. Isto evita o efeito de 'achatamento' típico da previsão
    recursiva, em que cada novo passo é gerado a partir da previsão anterior
    (já suavizada) em vez dos dados reais, fazendo a curva convergir para uma
    média quase constante.

    Treina-se só com X_train/y_train (80%); X_test/y_test (20% mais recente)
    é passado como validation_data apenas para acompanhar a evolução por época —
    o MAE reportado oficialmente vem de evaluate_on_test, chamado depois do fit."""
    print(f"A treinar modelo LSTM (multi-step direto, {FORECAST_STEPS} saídas) "
          f"com {len(X_train)} amostras de treino / {len(X_test)} de teste...")
    model = Sequential()
    model.add(Input(shape=(X_train.shape[1], X_train.shape[2])))
    model.add(LSTM(units=64, return_sequences=False))
    model.add(Dropout(0.2))
    model.add(Dense(units=32, activation='relu'))
    model.add(Dense(units=FORECAST_STEPS))
    model.compile(optimizer='adam', loss='mean_squared_error')

    fit_kwargs = {"epochs": 30, "batch_size": 32, "verbose": 1}
    if len(X_test) > 0:
        fit_kwargs["validation_data"] = (X_test, y_test)
    model.fit(X_train, y_train, **fit_kwargs)
    return model


# PREVISÃO DA PRÓXIMA HORA

def predict_future(model, data_scaled, energy_scaler, machine_id, machine_type):
    """Gera as FORECAST_STEPS previsões (+5, +10... +60 min) numa única passagem
    direta pelo modelo, em vez de realimentar previsões anteriores."""
    window = np.array([data_scaled[-WINDOW_SIZE:]])
    pred_scaled = model.predict(window, verbose=0)[0]  # shape (FORECAST_STEPS,)

    step_results = []  # (step_num, energy_kWh, energy_scaled)
    for step in range(1, FORECAST_STEPS + 1):
        scaled_value = float(pred_scaled[step - 1])
        pred_energy = float(energy_scaler.inverse_transform([[scaled_value]])[0][0])
        step_results.append((step, pred_energy, scaled_value))

    # Margem calculada com base no erro histórico do modelo (ver calculate_error_margin)
    margin = calculate_error_margin(step_results[0][1], energy_scaler, model, data_scaled)

    print("\n" + "=" * 60)
    print(f"PREVISÃO {FORECAST_HOURS}H: {machine_id}")
    for step, energy, _ in step_results:
        print(f"  +{step * STEP_MINUTES}min: {energy:.2f} kWh  (±{margin:.2f})")
    print("=" * 60 + "\n")

    save_predictions_multi(machine_id, machine_type, step_results, margin)
    return [r[1] for r in step_results]


def calculate_error_margin(predicted_energy, energy_scaler, model, data_scaled):
    """Margem de incerteza usada para a banda min/max das previsões: compara a
    previsão do passo mais próximo (+BUCKET_MINUTES min) com a leitura real que
    de facto ocorreu nesse bloco, em várias janelas recentes já confirmadas.
    É um indicador rápido/local de erro, diferente do MAE formal de teste
    (esse vem de evaluate_on_test, sobre o split 80/20)."""
    try:
        max_idx = len(data_scaled) - WINDOW_SIZE - 1  # último idx válido (inclusive)
        if max_idx < 0:
            return round(predicted_energy * 0.1, 3)

        check_points = min(10, max_idx + 1)
        start_idx = max_idx - check_points + 1

        errors = []
        for offset in range(check_points):
            idx = start_idx + offset
            window = np.array([data_scaled[idx:idx + WINDOW_SIZE]])
            pred_scaled = model.predict(window, verbose=0)[0]
            pred = float(energy_scaler.inverse_transform([[pred_scaled[0]]])[0][0])
            real = float(energy_scaler.inverse_transform([[data_scaled[idx + WINDOW_SIZE][0]]])[0][0])
            errors.append(abs(pred - real))

        margin = float(np.mean(errors)) if errors else predicted_energy * 0.1
        return round(margin, 3)
    except Exception as e:
        print(f"Erro ao calcular margem: {e}")
        return round(predicted_energy * 0.1, 3)


def save_predictions_multi(machine_id, machine_type, step_results, margin):
    """Guarda as previsões (1 por bloco, até 1h) com timestamps futuros no CrateDB."""
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


# CLASSIFICADOR DE RISCO DE FALHA (regressão logística)

def build_failure_dataset(df, feature_window=FAILURE_FEATURE_WINDOW, lookahead=FAILURE_LOOKAHEAD):
    """Constrói (X, y) a partir do histórico em bruto: features de uma janela
    recente, rótulo = ocorreu algum erro nas próximas `lookahead` leituras."""
    err = (df["error_code"].fillna(0) > 0).astype(int).to_numpy()
    energy = df["energy_consumed"].to_numpy(dtype=float)
    thread = df["thread_remaining"].to_numpy(dtype=float)
    n = len(df)

    X, y = [], []
    for i in range(feature_window, n - lookahead):
        recent_err_rate = err[i - feature_window:i].mean()
        energy_roll_mean = energy[i - feature_window:i].mean()
        energy_dev = energy[i] - energy_roll_mean
        thread_level = thread[i]
        X.append([recent_err_rate, energy_dev, thread_level])
        y.append(1 if err[i + 1:i + 1 + lookahead].max() > 0 else 0)

    return np.array(X), np.array(y)


def train_failure_model(df, feature_window=FAILURE_FEATURE_WINDOW, lookahead=FAILURE_LOOKAHEAD):
    """Treina um classificador binário de risco de falha e devolve
    (failure_probability_atual, accuracy_em_teste, n_amostras)."""
    X, y = build_failure_dataset(df, feature_window, lookahead)

    if len(X) < 30 or len(np.unique(y)) < 2:
        print("Dados insuficientes ou sem variação de classes para o classificador de falha.")
        return None, None, len(X)

    try:
        # split estratificado: garante as duas classes em treino e teste,
        # mesmo com poucas ocorrências de falha (dataset desequilibrado).
        # Aqui (ao contrário do LSTM de energia) não há o mesmo risco de
        # sobreposição entre amostras vizinhas a justificar um split cronológico,
        # por isso opta-se por estratificar para garantir as duas classes.
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, stratify=y, random_state=42
        )
        clf = LogisticRegression(class_weight="balanced", max_iter=500)
        clf.fit(X_train, y_train)
    except ValueError as e:
        print(f"Não foi possível treinar o classificador de falha (dados insuficientes): {e}")
        return None, None, len(X)

    accuracy = None
    if len(X_test) > 0 and len(np.unique(y_test)) >= 1:
        accuracy = float(accuracy_score(y_test, clf.predict(X_test)))

    # Probabilidade de falha "agora", com base na janela mais recente de leituras
    err = (df["error_code"].fillna(0) > 0).astype(int).to_numpy()
    energy = df["energy_consumed"].to_numpy(dtype=float)
    thread = df["thread_remaining"].to_numpy(dtype=float)

    recent_err_rate = err[-feature_window:].mean()
    energy_roll_mean = energy[-feature_window:].mean()
    energy_dev = energy[-1] - energy_roll_mean
    thread_level = thread[-1]

    current_features = np.array([[recent_err_rate, energy_dev, thread_level]])
    failure_probability = float(clf.predict_proba(current_features)[0][1])

    print(f"Classificador de falha: prob={failure_probability:.3f} accuracy={accuracy} n={len(X)}")
    return failure_probability, accuracy, len(X)


def save_metrics(entity_id, mae, failure_probability, failure_accuracy, samples_used):
    """Guarda o snapshot mais recente das métricas do modelo (MAE de teste do
    LSTM, risco de falha, accuracy do classificador e nº de amostras usadas)
    no CrateDB."""
    try:
        conn = client.connect([CRATE_HOST])
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mttextile.lstm_metrics (
                time_index TIMESTAMP,
                entity_id TEXT,
                mae DOUBLE,
                failure_probability DOUBLE,
                failure_accuracy DOUBLE,
                samples_used INTEGER
            )
        """)

        cursor.execute("DELETE FROM mttextile.lstm_metrics WHERE entity_id = ?", (entity_id,))

        now_ms = int(time.time() * 1000)
        cursor.execute("""
            INSERT INTO mttextile.lstm_metrics
            (time_index, entity_id, mae, failure_probability, failure_accuracy, samples_used)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            now_ms,
            entity_id,
            mae,
            failure_probability,
            failure_accuracy,
            samples_used,
        ))

        conn.close()
        print(f"Métricas guardadas para {entity_id}: MAE={mae} falha_prob={failure_probability} accuracy={failure_accuracy}")
    except Exception as e:
        print(f"Erro ao guardar métricas: {e}")


# LOOP PRINCIPAL

def run_cycle():
    print("\n========== NOVO CICLO LSTM ==========")
    machine_ids = load_machine_ids()
    print(f"Máquinas configuradas neste ciclo: {len(machine_ids)} -> {machine_ids}")
    for machine in machine_ids:
        df = fetch_data(machine)
        machine_type = df['machinetype'].iloc[-1] if 'machinetype' in df.columns and len(df) else "Desconhecido"

        # --- Classificador de risco de falha: disponível bem mais cedo (~35min) ---
        if len(df) >= MIN_RAW_FOR_FAILURE:
            failure_probability, failure_accuracy, samples_used = train_failure_model(df)
        else:
            print(f"[{machine}] dados insuficientes para o classificador de falha "
                  f"({len(df)} leituras; mínimo {MIN_RAW_FOR_FAILURE}).")
            failure_probability, failure_accuracy, samples_used = None, None, 0

        # --- LSTM de energia: 12h de contexto -> 1h de previsão (~13h de aquecimento) ---
        bucketed = resample_to_buckets(df)
        print(f"[{machine}] após agregação em blocos de {BUCKET_MINUTES}min: {len(bucketed)} blocos "
              f"(a partir de {len(df)} leituras em bruto)")
        if len(bucketed) >= MIN_BUCKETS_FOR_LSTM:
            X, y, scaler, energy_scaler, data_scaled = prepare_data(bucketed)
            X_train, X_test, y_train, y_test = chronological_split(X, y, TRAIN_FRACTION)
            print(f"[{machine}] split 80/20 cronológico: {len(X_train)} amostras de treino "
                  f"(mais antigas) / {len(X_test)} de teste (mais recentes, nunca vistas em treino)")

            model = build_and_train_model(X_train, y_train, X_test, y_test)
            predict_future(model, data_scaled, energy_scaler, machine, machine_type)
            mae = evaluate_on_test(model, X_test, y_test, energy_scaler)
            print(f"[{machine}] MAE no conjunto de teste (20% mais recente): {mae} kWh")

            save_metrics(machine, mae, failure_probability, failure_accuracy, samples_used)
            print(f"Processo concluído para {machine}.\n")
        else:
            print(f"[{machine}] dados insuficientes para o LSTM de energia "
                  f"({len(bucketed)} blocos de {BUCKET_MINUTES}min; mínimo {MIN_BUCKETS_FOR_LSTM} "
                  f"≈ {MIN_RAW_FOR_LSTM} leituras em bruto ≈ "
                  f"{round(MIN_RAW_FOR_LSTM * RAW_READING_INTERVAL_SECONDS / 3600, 1)}h). A aguardar...")
            if failure_probability is not None or failure_accuracy is not None:
                # já há classificador de falha mesmo sem o LSTM de energia pronto
                save_metrics(machine, None, failure_probability, failure_accuracy, samples_used)


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
    print(f"Config: janela={HOURS_OF_HISTORY}h ({WINDOW_SIZE} blocos de {BUCKET_MINUTES}min) "
          f"-> previsão={FORECAST_HOURS}h ({FORECAST_STEPS} passos) | split treino/teste={int(TRAIN_FRACTION*100)}/{int((1-TRAIN_FRACTION)*100)}")
    wait_for_crate()
    while True:
        try:
            run_cycle()
        except Exception as e:
            print(f"Erro no ciclo LSTM: {e}")
        print(f"Próximo ciclo em {RUN_INTERVAL} segundos...")
        time.sleep(RUN_INTERVAL)
