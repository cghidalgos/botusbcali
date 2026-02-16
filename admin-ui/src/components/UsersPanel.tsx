import { useEffect, useState } from "react";
import { Users, MessageSquare, Trash2, Lock, LockOpen, Send, RefreshCcw } from "lucide-react";
import {
  blockUser,
  clearUserHistory,
  formatDate,
  getUserHistory,
  listUsers,
  sendMessageToUser,
  type HistoryEntry,
  type UserProfile,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const UsersPanel = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await listUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUserHistory = async (userId: string) => {
    try {
      setHistoryLoading(true);
      const history = await getUserHistory(userId);
      setUserHistory(history);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setMessageText("");
    loadUserHistory(userId);
  };

  const handleBlockUser = async (userId: string, currentlyBlocked: boolean) => {
    try {
      const updated = await blockUser(userId, !currentlyBlocked);
      setUsers((prev) => prev.map((user) => (user.userId === userId ? updated : user)));
      toast.success(updated.blocked ? "Usuario bloqueado" : "Usuario desbloqueado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado del usuario.");
    }
  };

  const handleClearHistory = async (userId: string) => {
    if (!confirm("¿Seguro que deseas borrar todo el historial de este usuario?")) return;
    try {
      await clearUserHistory(userId);
      setUserHistory([]);
      toast.success("Historial eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo limpiar el historial.");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedUserId || !messageText.trim()) return;
    try {
      setSendingMessage(true);
      await sendMessageToUser(selectedUserId, messageText);
      setMessageText("");
      toast.success("Mensaje enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Users List */}
      <div className="lg:col-span-1 panel">
        <div className="flex items-center justify-between mb-4">
          <h2 className="panel-title mb-0">
            <Users className="w-5 h-5 text-primary" />
            Usuarios
          </h2>
          <button type="button" className="btn-secondary" onClick={loadUsers}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">Cargando usuarios...</p>}

        {!loading && users.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay usuarios aún.</p>
        )}

        {!loading && users.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((user) => (
              <button
                key={user.userId}
                type="button"
                onClick={() => handleSelectUser(String(user.userId))}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedUserId === String(user.userId)
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.name || `Usuario ${user.userId}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">ID: {user.userId}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mensajes: {user.messageCount}
                    </p>
                  </div>
                  {user.blocked && (
                    <Lock className="w-4 h-4 text-destructive shrink-0 mt-1" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected User Details & History */}
      <div className="lg:col-span-2 space-y-6">
        {selectedUserId ? (
          <>
            {/* User Info */}
            <div className="panel">
              {users.find((u) => String(u.userId) === selectedUserId) && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Detalles del usuario</h3>
                    <div className="flex gap-2">
                      {users.find((u) => String(u.userId) === selectedUserId)?.blocked && (
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded">
                          BLOQUEADO
                        </span>
                      )}
                    </div>
                  </div>

                  {users.find((u) => String(u.userId) === selectedUserId) && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {users.find((u) => String(u.userId) === selectedUserId)?.name && (
                        <div>
                          <p className="text-xs text-muted-foreground">Nombre</p>
                          <p className="text-sm font-semibold text-foreground">
                            {users.find((u) => String(u.userId) === selectedUserId)?.name}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">ID Usuario</p>
                        <p className="text-sm font-semibold text-foreground">{selectedUserId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Primer contacto</p>
                        <p className="text-xs text-foreground">
                          {formatDate(
                            users.find((u) => String(u.userId) === selectedUserId)?.firstSeen
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Último contacto</p>
                        <p className="text-xs text-foreground">
                          {formatDate(
                            users.find((u) => String(u.userId) === selectedUserId)?.lastSeen
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total de mensajes</p>
                        <p className="text-sm font-semibold text-foreground">
                          {users.find((u) => String(u.userId) === selectedUserId)?.messageCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estilo de conversación</p>
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {users.find((u) => String(u.userId) === selectedUserId)?.conversationStyle}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`btn-sm ${
                        users.find((u) => String(u.userId) === selectedUserId)?.blocked
                          ? "btn-success"
                          : "btn-warning"
                      }`}
                      onClick={() => {
                        const user = users.find((u) => String(u.userId) === selectedUserId);
                        if (user) handleBlockUser(String(user.userId), user.blocked);
                      }}
                    >
                      {users.find((u) => String(u.userId) === selectedUserId)?.blocked ? (
                        <>
                          <LockOpen className="w-4 h-4 mr-1" />
                          Desbloquear
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-1" />
                          Bloquear
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn-sm btn-danger"
                      onClick={() => handleClearHistory(String(selectedUserId))}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Limpiar historial
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Direct Message */}
            <div className="panel">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Enviar mensaje directo
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendingMessage}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation History */}
            <div className="panel">
              <h3 className="text-lg font-semibold text-foreground mb-4">Conversación</h3>

              {historyLoading && <p className="text-sm text-muted-foreground">Cargando historial...</p>}
              {!historyLoading && userHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay conversaciones aún.</p>
              )}
              {!historyLoading && userHistory.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {userHistory.map((item, i) => (
                    <div key={`${item.question}-${i}`} className="rounded-lg border border-border p-3">
                      <p className="text-sm text-foreground">
                        <strong>👤 Usuario:</strong> {item.question}
                      </p>
                      <p className="text-sm text-accent mt-2">
                        <strong>🤖 Bot:</strong> {item.answer}
                      </p>
                      <p className="text-xs text-muted-foreground text-right mt-2">
                        {formatDate(String(item.timestamp))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="panel text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Selecciona un usuario para ver sus detalles</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPanel;
