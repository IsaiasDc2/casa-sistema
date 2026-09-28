import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const entrar = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setError("Email o contraseña incorrectos");
    else navigate("/app", { replace: true });
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={entrar}>
        <h1>Casa Isaias</h1>
        <p>Sistema de punto de venta</p>
        {error && <p className="auth-error">{error}</p>}
        <input
          type="email" required placeholder="Email" autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password" required placeholder="Contraseña"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
