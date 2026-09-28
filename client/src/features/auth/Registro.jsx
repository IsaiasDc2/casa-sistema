import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function Registro() {
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "" });
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const registrar = async (e) => {
    e.preventDefault();
    setMsg(null);
    setCargando(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { nombre: form.nombre, apellido: form.apellido } },
    });
    setCargando(false);
    if (error) setMsg({ ok: false, texto: error.message });
    else
      setMsg({
        ok: true,
        texto: "Cuenta creada. Un administrador te asignará tu rol antes de operar.",
      });
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={registrar}>
        <h1>Crear cuenta</h1>
        <p>Casa Isaias · acceso del personal</p>
        {msg && <p className={msg.ok ? "ok" : "auth-error"}>{msg.texto}</p>}
        <input placeholder="Nombre" required value={form.nombre} onChange={set("nombre")} />
        <input placeholder="Apellido" value={form.apellido} onChange={set("apellido")} />
        <input
          type="email" required placeholder="Email"
          value={form.email} onChange={set("email")}
        />
        <input
          type="password" required minLength={6} placeholder="Contraseña (mín. 6)"
          value={form.password} onChange={set("password")}
        />
        <button type="submit" disabled={cargando}>
          {cargando ? "Creando…" : "Registrarme"}
        </button>
        <p className="auth-link">
          ¿Ya tienes cuenta? <Link to="/login">Ingresar</Link>
        </p>
      </form>
    </main>
  );
}
