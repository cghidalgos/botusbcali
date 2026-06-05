import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createAuthUser, deleteAuthUser, listAuthUsers, listBots, updateAuthUser, type AuthUserRecord, type BotRecord } from "@/lib/api";
import { setManageMode, setStoredBotId } from "@/lib/botContext";

const emptyDraft = {
  email: "",
  password: "",
  role: "manager" as const,
  botIds: [] as string[],
};

const AuthUsersPanel = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AuthUserRecord[]>([]);
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  const botOptions = useMemo(
    () => bots.map((bot) => ({ id: bot.id, name: bot.name || bot.id })),
    [bots]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersResponse, botsResponse] = await Promise.all([listAuthUsers(), listBots()]);
      setUsers(usersResponse.users);
      setBots(botsResponse.bots);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createAuthUser({
        email: draft.email.trim(),
        password: draft.password,
        role: draft.role,
        botIds: draft.role === "admin" ? [] : draft.botIds,
      });
      setUsers((prev) => [...prev, created.user]);
      setDraft({ ...emptyDraft });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBot = (botId: string, userId: string) => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        const next = new Set(user.botIds || []);
        if (next.has(botId)) {
          next.delete(botId);
        } else {
          next.add(botId);
        }
        return { ...user, botIds: Array.from(next) };
      })
    );
  };

  const handleUpdate = async (user: AuthUserRecord) => {
    setSaving(true);
    try {
      const nextPassword = passwords[user.id] || "";
      const updated = await updateAuthUser(user.id, {
        email: user.email.trim(),
        role: user.role,
        botIds: user.role === "admin" ? [] : user.botIds,
        ...(nextPassword ? { password: nextPassword } : {}),
      });
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated.user : item)));
      setEditingId(null);
      setPasswords((prev) => ({ ...prev, [user.id]: "" }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await deleteAuthUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el usuario.");
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Usuarios administradores y managers</h2>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <form onSubmit={handleCreate} className="inline-form">
        <label className="form-label">Correo</label>
        <input
          className="form-input"
          value={draft.email}
          onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="correo@dominio.com"
          required
        />

        <label className="form-label">Contrasena</label>
        <input
          className="form-input"
          type="password"
          value={draft.password}
          onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
          placeholder="Temporal"
          required
        />

        <label className="form-label">Rol</label>
        <select
          className="form-input"
          value={draft.role}
          onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value as AuthUserRecord["role"] }))}
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
        </select>

        {draft.role === "manager" && (
          <div>
            <label className="form-label">Bots asignados</label>
            <div className="flex flex-wrap gap-2">
              {botOptions.map((bot) => {
                const selected = draft.botIds.includes(bot.id);
                return (
                  <button
                    key={bot.id}
                    type="button"
                    className={`text-xs px-3 py-1 rounded-full border ${selected ? "bg-primary text-primary-foreground" : "bg-white"}`}
                    onClick={() =>
                      setDraft((prev) => {
                        const next = new Set(prev.botIds);
                        if (next.has(bot.id)) {
                          next.delete(bot.id);
                        } else {
                          next.add(bot.id);
                        }
                        return { ...prev, botIds: Array.from(next) };
                      })
                    }
                  >
                    {bot.name}
                  </button>
                );
              })}
              {botOptions.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay bots creados.</span>
              )}
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary mt-4 w-full" disabled={saving}>
          <Plus className="w-4 h-4 mr-2" />
          {saving ? "Guardando..." : "Crear usuario"}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Cargando usuarios...</p>}
        {!loading && users.length === 0 && (
          <p className="text-sm text-muted-foreground">Aun no hay usuarios creados.</p>
        )}

        {users.map((user) => {
          const isEditing = editingId === user.id;
          return (
            <div key={user.id} className="doc-card items-start">
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <>
                    <input
                      className="form-input"
                      value={user.email}
                      onChange={(event) =>
                        setUsers((prev) =>
                          prev.map((item) =>
                            item.id === user.id ? { ...item, email: event.target.value } : item
                          )
                        )
                      }
                    />
                    <select
                      className="form-input"
                      value={user.role}
                      onChange={(event) =>
                        setUsers((prev) =>
                          prev.map((item) =>
                            item.id === user.id
                              ? { ...item, role: event.target.value as AuthUserRecord["role"] }
                              : item
                          )
                        )
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                    <input
                      className="form-input"
                      type="password"
                      value={passwords[user.id] || ""}
                      onChange={(event) =>
                        setPasswords((prev) => ({ ...prev, [user.id]: event.target.value }))
                      }
                      placeholder="Nueva contrasena (opcional)"
                    />
                    {user.role === "manager" && (
                      <div className="flex flex-wrap gap-2">
                        {botOptions.map((bot) => {
                          const selected = (user.botIds || []).includes(bot.id);
                          return (
                            <button
                              key={bot.id}
                              type="button"
                              className={`text-xs px-3 py-1 rounded-full border ${selected ? "bg-primary text-primary-foreground" : "bg-white"}`}
                              onClick={() => handleToggleBot(bot.id, user.id)}
                            >
                              {bot.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-foreground">{user.email}</div>
                    <div className="text-xs text-muted-foreground">Rol: {user.role}</div>
                    {user.role === "manager" && (
                      <div className="text-xs text-muted-foreground space-y-2">
                        <div>
                          Bots: {(user.botIds || []).length ? (user.botIds || []).join(", ") : "Sin bots"}
                        </div>
                        {(user.botIds || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(user.botIds || []).map((botId) => (
                              <button
                                key={botId}
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  setManageMode(true);
                                  setStoredBotId(botId);
                                  navigate("/");
                                }}
                              >
                                Administrar {botId}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {isEditing ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleUpdate(user)}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(user.id)}>
                    Editar
                  </button>
                )}
                <button type="button" className="btn-danger" onClick={() => handleDelete(user.id)}>
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

export default AuthUsersPanel;
