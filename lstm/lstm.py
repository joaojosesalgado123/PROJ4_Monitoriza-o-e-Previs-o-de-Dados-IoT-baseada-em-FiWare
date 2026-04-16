import numpy as np
import pandas as pd
import requests
from crate import client  
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, Input


# CONFIGURAÇÕES

CRATE_HOST = "localhost:4200"               
SCHEMA_TABLE = "mttextile.ettextilemachine"   
MACHINE_IDS = [
    "urn:ngsi-ld:TextileMachine:001",
    "urn:ngsi-ld:TextileMachine:002",
    "urn:ngsi-ld:TextileMachine:003"
]
WINDOW_SIZE = 60 # 60 leituras / ultimos 30 minutos


# EXTRAÇÃO DE DADOS (CRATEDB)

def fetch_data(machine_id):
    print(f"\n--- A ligar ao CrateDB e extrair histórico da {machine_id} ---")
    conn = client.connect([CRATE_HOST])
    
    query = f"""
        SELECT time_index, energy_consumed, thread_remaining, error_code 
        FROM {SCHEMA_TABLE}
        WHERE entity_id = '{machine_id}' 
        ORDER BY time_index ASC
    """
    df = pd.read_sql(query, conn)
    conn.close()
    
    # Preencher falhas caso existam
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
    
    # Entrada
    model.add(Input(shape=(X.shape[1], X.shape[2])))
    
    # LSTM
    model.add(LSTM(units=50, return_sequences=False))
    model.add(Dropout(0.2)) 
    
    # 1 previsão
    model.add(Dense(units=1))
    
    model.compile(optimizer='adam', loss='mean_squared_error')
    
    # Treino
    model.fit(X, y, epochs=20, batch_size=32, validation_split=0.2, verbose=1)
    return model


# PREVISÃO DO FUTURO E ENVIO

def predict_future(model, data_scaled, energy_scaler, machine_id):
    # últimas 60 leituras
    last_window = np.array([data_scaled[-WINDOW_SIZE:]])
    
    # previsão (escala 0 a 1)
    predicted_val_scaled = model.predict(last_window)
    
    # Reverter kWh normais 
    predicted_energy = float(energy_scaler.inverse_transform(predicted_val_scaled)[0][0])
    
    print("\n" + "="*60)
    print(f"PREVISÃO DA INTELIGÊNCIA ARTIFICIAL: {machine_id}")
    print(f"Com base nos últimos 30 minutos, o consumo previsto")
    print(f"para o próximo ciclo é: {predicted_energy:.2f} kWh")
    print("="*60 + "\n")


# EXECUÇÃO PRINCIPAL

if __name__ == "__main__":
    for machine in MACHINE_IDS:
        df = fetch_data(machine)
        
        if len(df) < WINDOW_SIZE + 10:
            print(f"Aviso: Faltam dados reais na {machine}. Deixa o 'agent.py' correr mais tempo!")
        else:
            X, y, scaler, energy_scaler, data_scaled = prepare_data(df)
            model = build_and_train_model(X, y)
            predict_future(model, data_scaled, energy_scaler, machine)
            print(f" Processo concluído para a {machine}.\n")