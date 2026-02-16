import UsersPanel from "@/components/UsersPanel";

const UsersPage = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Gestión de usuarios</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Visualiza a todos los usuarios, revisa conversaciones, bloquea/desbloquea y envía mensajes directos.
      </p>
    </div>
    <UsersPanel />
  </div>
);

export default UsersPage;
