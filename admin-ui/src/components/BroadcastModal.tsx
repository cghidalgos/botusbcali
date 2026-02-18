import { useState } from "react";
import { Send, Upload, X, Image, Video, Music, FileText } from "lucide-react";
import { sendBroadcast, type BroadcastOptions, type UserProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: UserProfile[];
  sendToAll: boolean;
}

const BroadcastModal = ({ open, onClose, selectedUsers, sendToAll }: BroadcastModalProps) => {
  const [messageText, setMessageText] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "video" | "audio" | "document" | "">("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastSecret, setBroadcastSecret] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      // Auto-detectar tipo de media
      if (file.type.startsWith("image/")) setMediaType("photo");
      else if (file.type.startsWith("video/")) setMediaType("video");
      else if (file.type.startsWith("audio/")) setMediaType("audio");
      else setMediaType("document");
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() && !mediaFile) {
      toast.error("Debes escribir un mensaje o subir un archivo multimedia");
      return;
    }

    if (!broadcastSecret.trim()) {
      toast.error("Debes ingresar el secreto de broadcast");
      return;
    }

    try {
      setSending(true);

      const options: BroadcastOptions = {
        text: messageText.trim() || undefined,
        sendToAll,
        chatIds: sendToAll ? undefined : selectedUsers.map(u => String(u.chatId)),
        mediaType: mediaFile ? mediaType : undefined,
        mediaCaption: mediaCaption.trim() || undefined,
        mediaFile: mediaFile || undefined,
        broadcastSecret: broadcastSecret.trim(),
      };

      const result = await sendBroadcast(options);

      toast.success(
        `Difusión completada: ${result.sent}/${result.targetCount} enviados. ${
          result.failures.length > 0 ? `${result.failures.length} fallos` : ""
        }`
      );

      // Reset
      setMessageText("");
      setMediaType("");
      setMediaFile(null);
      setMediaCaption("");
      setBroadcastSecret("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la difusión");
    } finally {
      setSending(false);
    }
  };

  const getMediaIcon = () => {
    switch (mediaType) {
      case "photo":
        return <Image className="w-5 h-5" />;
      case "video":
        return <Video className="w-5 h-5" />;
      case "audio":
        return <Music className="w-5 h-5" />;
      case "document":
        return <FileText className="w-5 h-5" />;
      default:
        return <Upload className="w-5 h-5" />;
    }
  };

  const recipientCount = sendToAll ? "todos los usuarios" : `${selectedUsers.length} usuario(s)`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Enviar mensaje de difusión
          </DialogTitle>
          <DialogDescription>
            Enviarás este mensaje a <strong>{recipientCount}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Secreto de broadcast */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Secreto de broadcast <span className="text-destructive">*</span>
            </label>
            <Input
              type="password"
              placeholder="Ingresa el secreto configurado en BROADCAST_SECRET"
              value={broadcastSecret}
              onChange={(e) => setBroadcastSecret(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este secreto está configurado en el archivo .env del servidor
            </p>
          </div>

          {/* Mensaje de texto */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Mensaje de texto
            </label>
            <Textarea
              placeholder="Escribe tu mensaje aquí..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Multimedia */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Archivo multimedia (opcional)
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors">
                  {getMediaIcon()}
                  <span className="text-sm text-muted-foreground">
                    {mediaFile ? mediaFile.name : "Subir imagen, video, audio o documento"}
                  </span>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileChange}
                />
              </label>
              {mediaFile && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaType("");
                  }}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {mediaFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Tipo: {mediaType} • Tamaño: {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          {/* Leyenda para multimedia */}
          {mediaFile && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Leyenda del archivo (opcional)
              </label>
              <Input
                placeholder="Texto que acompaña al archivo multimedia..."
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
              />
            </div>
          )}

          {/* Destinatarios */}
          {!sendToAll && selectedUsers.length > 0 && (
            <div className="bg-muted/50 p-3 rounded-lg border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Destinatarios ({selectedUsers.length}):
              </p>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {selectedUsers.map((user) => {
                  const displayName =
                    user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`.trim()
                      : user.firstName || user.username || `Usuario ${user.chatId}`;
                  return (
                    <span
                      key={user.chatId}
                      className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                    >
                      {displayName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || (!messageText.trim() && !mediaFile) || !broadcastSecret.trim()}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Enviando..." : "Enviar difusión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BroadcastModal;
