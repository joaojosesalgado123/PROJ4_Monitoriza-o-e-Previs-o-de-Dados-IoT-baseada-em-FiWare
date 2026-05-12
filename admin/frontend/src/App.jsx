import { useState, useEffect } from "react";

const API = "/api";

const STATUS_COLOR = {
  running: "#4caf50",
  error: "#f44336",
  warning: "#ff9800",
  offline: "#9e9e9e",
  unknown: "#9e9e9e",
};

const STYLES = {
  app: {
    fontFamily: "Segoe UI, sans-serif",
    background: "#0f1117",
    minHeight: "100vh",
    color: "#e0e0e0",
    padding: "24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    borderBottom: "1px solid #2a2d3e",
    paddingBottom: "16px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#fff",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
    margin: "4px 0 0 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  card: {
    background: "#1a1d2e",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #2a2d3e",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  machineName: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
  },
  machineType: {
    fontSize: "12px",
    color: "#888",
    marginTop: "2px",
  },
  statusBadge: (status) => ({
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    background: STATUS_COLOR[status] + "22",
    color: STATUS_COLOR[status],
    border: `1px solid ${STATUS_COLOR[status]}44`,
  }),
  stat: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #2a2d3e",
    fontSize: "14px",
  },
  statLabel: { color: "#888" },
  statValue: { color: "#fff", fontWeight: "500" },
  deleteBtn: {
    marginTop: "16px",
    width: "100%",
    padding: "8px",
    background: "#f4433611",
    border: "1px solid #f4433644",
    borderRadius: "8px",
    color: "#f44336",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  section: {
    background: "#1a1d2e",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid #2a2d3e",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#fff",
    marginBottom: "20px",
    marginTop: 0,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "12px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    color: "#888",
  },
  input: {
    background: "#0f1117",
    border: "1px solid #2a2d3e",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  select: {
    background: "#0f1117",
    border: "1px solid #2a2d3e",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  addBtn: {
    marginTop: "8px",
    padding: "10px 24px",
    background: "#4caf5011",
    border: "1px solid #4caf5044",
    borderRadius: "8px",
    color: "#4caf50",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  saveBtn: {
    padding: "10px 24px",
    background: "#2196f311",
    border: "1px solid #2196f344",
    borderRadius: "8px",
    color: "#2196f3",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
  refreshBtn: {
    padding: "8px 16px",
    background: "#2a2d3e",
    border: "1px solid #3a3d4e",
    borderRadius: "8px",
    color: "#888",
    cursor: "pointer",
    fontSize: "13px",
  },
  error: {
    background: "#f4433611",
    border: "1px solid #f4433644",
    borderRadius: "8px",
    padding: "12px",
    color: "#f44336",
    fontSize: "14px",
    marginBottom: "16px",
  },
  success: {
    background: "#4caf5011",
    border: "1px solid #4caf5044",
    borderRadius: "8px",
    padding: "12px",
    color: "#4caf50",
    fontSize: "14px",
    marginBottom: "16px",
  },
};

export default function App() {
  const [deleteModal, setDeleteModal] = useState(null);
  const [machines, setMachines] = useState([]);
  const [config, setConfig] = useState({ send_interval: 30 });
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [newMachine, setNewMachine] = useState({
    name: "",
    type: "",
    base_energy: "",
    base_thread: "",
  });

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [mRes, cRes, tRes] = await Promise.all([
        fetch(`${API}/machines`),
        fetch(`${API}/config`),
        fetch(`${API}/types`),
      ]);
      setMachines(await mRes.json());
      setConfig(await cRes.json());
      setTypes(await tRes.json());
    } catch (e) {
      showMessage("Erro ao carregar dados da API", true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async () => {
    if (!newMachine.name || !newMachine.type || !newMachine.base_energy || !newMachine.base_thread) {
      showMessage("Preenche todos os campos", true);
      return;
    }
    try {
      const res = await fetch(`${API}/machines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMachine),
      });
      if (res.ok) {
        showMessage("Máquina adicionada com sucesso!");
        setNewMachine({ name: "", type: "", base_energy: "", base_thread: "" });
        fetchAll();
      } else {
        const err = await res.json();
        showMessage(err.error, true);
      }
    } catch (e) {
      showMessage("Erro ao adicionar máquina", true);
    }
  };

  const handleDelete = (id) => {
    setDeleteModal(id);
  };

  const confirmDelete = async (purge) => {
    const id = deleteModal;
    setDeleteModal(null);
    const number = id.split(":").pop();
    try {
      const res = await fetch(`${API}/machines/${number}?purge=${purge}`, { method: "DELETE" });
      if (res.ok) {
        showMessage(purge ? "Máquina e dados históricos removidos!" : "Máquina removida (histórico mantido)!");
        fetchAll();
      } else {
        showMessage("Erro ao remover máquina", true);
      }
    } catch (e) {
      showMessage("Erro ao remover máquina", true);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await fetch(`${API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        showMessage("Configuração guardada! Reinicia o agente para aplicar.");
      } else {
        const err = await res.json();
        showMessage(err.error, true);
      }
    } catch (e) {
      showMessage("Erro ao guardar configuração", true);
    }
  };

  return (
    <div style={STYLES.app}>
      <div style={STYLES.header}>
        <div>
          <h1 style={STYLES.title}>Painel de Administração</h1>
          <p style={STYLES.subtitle}>Monitorização IoT — Máquinas Têxteis</p>
        </div>
        <button style={STYLES.refreshBtn} onClick={fetchAll}>
          ↻ Atualizar
        </button>
      </div>

      {message && (
        <div style={message.isError ? STYLES.error : STYLES.success}>
          {message.text}
        </div>
      )}

      {/* Máquinas */}
      <h2 style={{ ...STYLES.sectionTitle, marginBottom: "16px" }}>
        Máquinas ({machines.length})
      </h2>
      {loading ? (
        <p style={{ color: "#888" }}>A carregar...</p>
      ) : (
        <div style={STYLES.grid}>
          {machines.map((m) => (
            <div key={m.id} style={STYLES.card}>
              <div style={STYLES.cardHeader}>
                <div>
                  <div style={STYLES.machineName}>{m.name}</div>
                  <div style={STYLES.machineType}>{m.type}</div>
                </div>
                <span style={STYLES.statusBadge(m.status || "unknown")}>
                  {m.status || "unknown"}
                </span>
              </div>
              <div style={STYLES.stat}>
                <span style={STYLES.statLabel}>Energia</span>
                <span style={STYLES.statValue}>{m.energy_consumed?.toFixed(2) ?? "—"} kWh</span>
              </div>
              <div style={STYLES.stat}>
                <span style={STYLES.statLabel}>Fio restante</span>
                <span style={STYLES.statValue}>{m.thread_remaining?.toFixed(1) ?? "—"} m</span>
              </div>
              <div style={STYLES.stat}>
                <span style={STYLES.statLabel}>Erro</span>
                <span style={STYLES.statValue}>{m.error_description || "OK"}</span>
              </div>
              <div style={STYLES.stat}>
                <span style={STYLES.statLabel}>ID</span>
                <span style={{ ...STYLES.statValue, fontSize: "11px", color: "#666" }}>{m.id}</span>
              </div>
              <button style={STYLES.deleteBtn} onClick={() => handleDelete(m.id)}>
                Remover máquina
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar máquina */}
      <div style={STYLES.section}>
        <h2 style={STYLES.sectionTitle}>Adicionar Máquina</h2>
        <div style={STYLES.formRow}>
          <div style={STYLES.formGroup}>
            <label style={STYLES.label}>Nome</label>
            <input
              style={STYLES.input}
              placeholder="ex: Máquina D"
              value={newMachine.name}
              onChange={(e) => setNewMachine({ ...newMachine, name: e.target.value })}
            />
          </div>
          <div style={STYLES.formGroup}>
            <label style={STYLES.label}>Tipo</label>
            <select
              style={STYLES.select}
              value={newMachine.type}
              onChange={(e) => setNewMachine({ ...newMachine, type: e.target.value })}
            >
              <option value="">Seleciona um tipo</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={STYLES.formRow}>
          <div style={STYLES.formGroup}>
            <label style={STYLES.label}>Energia base (kWh)</label>
            <input
              style={STYLES.input}
              type="number"
              step="0.1"
              placeholder="ex: 5.2"
              value={newMachine.base_energy}
              onChange={(e) => setNewMachine({ ...newMachine, base_energy: e.target.value })}
            />
          </div>
          <div style={STYLES.formGroup}>
            <label style={STYLES.label}>Fio base (metros)</label>
            <input
              style={STYLES.input}
              type="number"
              placeholder="ex: 800"
              value={newMachine.base_thread}
              onChange={(e) => setNewMachine({ ...newMachine, base_thread: e.target.value })}
            />
          </div>
        </div>
        <button style={STYLES.addBtn} onClick={handleAdd}>
          + Adicionar Máquina
        </button>
      </div>

      {/* Configuração */}
      <div style={STYLES.section}>
        <h2 style={STYLES.sectionTitle}>Configuração do Agente</h2>
        <div style={{ ...STYLES.formRow, maxWidth: "400px" }}>
          <div style={STYLES.formGroup}>
            <label style={STYLES.label}>Intervalo de envio (segundos)</label>
            <input
              style={STYLES.input}
              type="number"
              min="5"
              value={config.send_interval}
              onChange={(e) => setConfig({ ...config, send_interval: parseInt(e.target.value) })}
            />
          </div>
        </div>
        <button style={STYLES.saveBtn} onClick={handleSaveConfig}>
          Guardar configuração
        </button>
      </div>

      {/* Modal de confirmação */}
        {deleteModal && (cewciwic
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#1a1d2e", borderRadius: "12px", padding: "32px",
            border: "1px solid #2a2d3e", maxWidth: "400px", width: "90%"
          }}>
            <h3 style={{ color: "#fff", marginTop: 0 }}>Remover Máquina</h3>
            <p style={{ color: "#888", fontSize: "14px" }}>
              O que queres fazer com os dados históricos da máquina <strong style={{color:"#fff"}}>{deleteModal}</strong>?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
              <button
                style={{ padding: "10px", background: "#f4433611", border: "1px solid #f4433644", borderRadius: "8px", color: "#f44336", cursor: "pointer", fontSize: "14px" }}
                onClick={() => confirmDelete(true)}
              >
                🗑️ Remover máquina E apagar dados históricos
              </button>
              <button
                style={{ padding: "10px", background: "#ff980011", border: "1px solid #ff980044", borderRadius: "8px", color: "#ff9800", cursor: "pointer", fontSize: "14px" }}
                onClick={() => confirmDelete(false)}
              >
                📦 Remover máquina (manter histórico)
              </button>
              <button
                style={{ padding: "10px", background: "#2a2d3e", border: "1px solid #3a3d4e", borderRadius: "8px", color: "#888", cursor: "pointer", fontSize: "14px" }}
                onClick={() => setDeleteModal(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}