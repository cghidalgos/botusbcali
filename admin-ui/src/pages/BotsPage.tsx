import BotsPanel from "@/components/BotsPanel";
import { useAuth } from "@/lib/authContext";

const BotsPage = () => {
  const { user } = useAuth();

  if (!user || user.role !== "admin") {
    return (
      <div className="panel">
        <h1 className="text-lg font-semibold text-foreground">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Solo los administradores pueden gestionar bots.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestión de bots</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea bots con sus tokens y API keys propios.
        </p>
      </div>
      <BotsPanel />
    </div>
  );
};

export default BotsPage;
