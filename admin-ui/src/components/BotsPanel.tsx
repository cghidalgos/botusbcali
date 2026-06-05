import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createAuthUser, createBot, deleteBot, listBots, updateBot, type BotRecord } from "@/lib/api";
import { setManageMode, setStoredBotId } from "@/lib/botContext";

type BotDraft = {
  id: string;
  name: string;
  imageUrl: string;
  telegramToken: string;
  claudeApiKey: string;
  status: "active" | "inactive";
  managerEmail: string;
  managerPassword: string;
};

const emptyDraft: BotDraft = {
  id: "",
  name: "",
  imageUrl: "",
  telegramToken: "",
  claudeApiKey: "",
  status: "active",
  managerEmail: "",
  managerPassword: "",
};

const BotsPanel = () => {
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BotDraft>({ ...emptyDraft });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadBots = async () => {
    try {
      setLoading(true);
      const response = await listBots();
      setBots(response.bots);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los bots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBots();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: draft.id?.trim() || undefined,
        name: draft.name?.trim(),
        imageUrl: draft.imageUrl?.trim(),
        telegramToken: draft.telegramToken?.trim(),
        claudeApiKey: draft.claudeApiKey?.trim(),
        status: draft.status,
      };
      const created = await createBot(payload);
      setBots((prev) => [...prev, created.bot]);

      const managerEmail = draft.managerEmail.trim();
      const managerPassword = draft.managerPassword;
      if (managerEmail && managerPassword) {
        try {
          await createAuthUser({
            email: managerEmail,
            password: managerPassword,
            role: "manager",
            botIds: [created.bot.id],
          });
        } catch (managerError) {
          setError(
            managerError instanceof Error
              ? `Bot creado. No se pudo crear el manager: ${managerError.message}`
              : "Bot creado. No se pudo crear el manager."
          );
        }
      }

      setDraft({ ...emptyDraft });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el bot.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (bot: BotRecord) => {
    setSaving(true);
    try {
      const updated = await updateBot(bot.id, {
        name: bot.name?.trim(),
        imageUrl: bot.imageUrl?.trim(),
        telegramToken: bot.telegramToken?.trim(),
        claudeApiKey: bot.claudeApiKey?.trim(),
        status: bot.status,
      });
      setBots((prev) => prev.map((item) => (item.id === bot.id ? updated.bot : item)));
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el bot.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (botId: string) => {
    if (!confirm("¿Eliminar este bot?") ) return;
    try {
      await deleteBot(botId);
      setBots((prev) => prev.filter((bot) => bot.id !== botId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el bot.");
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Bots</h2>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <form onSubmit={handleCreate} className="inline-form">
        <label className="form-label">Nombre del bot</label>
        <input
          className="form-input"
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Bot de ingeniería"
          required
        />

        <label className="form-label">ID (opcional)</label>
        <input
          className="form-input"
          value={draft.id}
          onChange={(event) => setDraft((prev) => ({ ...prev, id: event.target.value }))}
          placeholder="default"
        />

        <label className="form-label">Telegram token</label>
        <input
          className="form-input"
          value={draft.telegramToken}
          onChange={(event) => setDraft((prev) => ({ ...prev, telegramToken: event.target.value }))}
          placeholder="123:ABC"
        />

        <label className="form-label">Claude API key (Anthropic)</label>
        <input
          className="form-input"
          value={draft.claudeApiKey}
          onChange={(event) => setDraft((prev) => ({ ...prev, claudeApiKey: event.target.value }))}
          placeholder="sk-ant-..."
        />

        <label className="form-label">Estado</label>
        <select
          className="form-input"
          value={draft.status}
          onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as BotRecord["status"] }))}
        >
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <label className="form-label">Usuario manager (correo)</label>
        <input
          className="form-input"
          value={draft.managerEmail}
          onChange={(event) => setDraft((prev) => ({ ...prev, managerEmail: event.target.value }))}
          placeholder="fac@usbcali.edu.co"
          required
        />

        <label className="form-label">Contrasena del manager</label>
        <input
          className="form-input"
          type="password"
          value={draft.managerPassword}
          onChange={(event) => setDraft((prev) => ({ ...prev, managerPassword: event.target.value }))}
          placeholder="Temporal"
          required
        />

        <button type="submit" className="btn-primary mt-4 w-full" disabled={saving}>
          <Plus className="w-4 h-4 mr-2" />
          {saving ? "Guardando..." : "Crear bot"}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Cargando bots...</p>}
        {!loading && bots.length === 0 && (
          <p className="text-sm text-muted-foreground">Aun no hay bots registrados.</p>
        )}

        {bots.map((bot) => {
          const isEditing = editingId === bot.id;
          return (
            <div key={bot.id} className="doc-card items-start">
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <>
                    <input
                      className="form-input"
                      value={bot.name}
                      onChange={(event) =>
                        setBots((prev) =>
                          prev.map((item) =>
                            item.id === bot.id ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                    />
                    <input
                      className="form-input"
                      value={bot.telegramToken || ""}
                      onChange={(event) =>
                        setBots((prev) =>
                          prev.map((item) =>
                            item.id === bot.id
                              ? { ...item, telegramToken: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Telegram token"
                    />
                    <input
                      className="form-input"
                      value={bot.claudeApiKey || ""}
                      onChange={(event) =>
                        setBots((prev) =>
                          prev.map((item) =>
                            item.id === bot.id
                              ? { ...item, claudeApiKey: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="sk-ant-..."
                    />
                    <select
                      className="form-input"
                      value={bot.status}
                      onChange={(event) =>
                        setBots((prev) =>
                          prev.map((item) =>
                            item.id === bot.id
                              ? { ...item, status: event.target.value as BotRecord["status"] }
                              : item
                          )
                        )
                      }
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-foreground">{bot.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {bot.id}</div>
                    <div className="text-xs text-muted-foreground">
                      Estado: {bot.status === "active" ? "Activo" : "Inactivo"}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {isEditing ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleUpdate(bot)}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingId(bot.id)}
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setManageMode(true);
                    setStoredBotId(bot.id);
                    navigate("/");
                  }}
                >
                  Administrar
                </button>
                <button type="button" className="btn-danger" onClick={() => handleDelete(bot.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BotsPanel;
