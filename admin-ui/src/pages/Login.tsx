import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import logoBot from "@/assets/logoBot.png";
import AppFooter from "@/components/AppFooter";

type LocationState = {
  from?: { pathname?: string };
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email.trim(), password);
      const state = location.state as LocationState | null;
      const nextPath = state?.from?.pathname || "/";
      navigate(nextPath, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Credenciales invalidas";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <img src={logoBot} alt="Bot" className="w-14 h-14 object-contain" />
            <div className="text-center">
              <h1 className="text-xl font-semibold text-slate-900">Panel de administracion</h1>
              <p className="text-sm text-slate-500">Ingresa con tu correo y contrasena</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@dominio.com"
                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Contrasena
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contrasena"
                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                required
                autoComplete="current-password"
              />
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
      <AppFooter />
    </div>
  );
};

export default Login;
