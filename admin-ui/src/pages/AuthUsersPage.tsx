import AuthUsersPanel from "@/components/AuthUsersPanel";
import { useAuth } from "@/lib/authContext";

const AuthUsersPage = () => {
  const { user } = useAuth();

  if (!user || user.role !== "admin") {
    return (
      <div className="panel">
        <h1 className="text-lg font-semibold text-foreground">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Solo los administradores pueden gestionar usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuarios admin y managers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona accesos al panel y asigna bots a los managers.
        </p>
      </div>
      <AuthUsersPanel />
    </div>
  );
};

export default AuthUsersPage;
