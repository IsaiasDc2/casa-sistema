import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSesionContext } from "../../app/SesionContext";

const ESTADOS = ["activo", "bloqueado", "suspendido", "inactivo"];

export default function UsersPage() {
  const { profile } = useSesionContext();
  const [tab, setTab] = useState("usuarios");
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ email: "", legajo: "", sucursal_id: "" });

  const cargar = async () => {
    const [{ data: u }, { data: r }, { data: e }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("id,email,nombre,apellido,estado,roles(id,nombre)").order("created_at"),
      supabase.from("roles").select("id,nombre").order("nombre"),
      supabase.from("empleados").select("id,legajo,profiles(email,nombre),sucursales(nombre)").order("created_at"),
      supabase.from("sucursales").select("id,nombre").order("nombre"),
    ]);
    setUsuarios(u || []);
    setRoles(r || []);
    setEmpleados(e || []);
    setSucursales(s || []);
  };

  useEffect(() => {
    cargar();
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const guardarUsuario = async (u, campo, valor) => {
    if (u.id === profile.id && campo === "rol_id") {
      avisar("No puedes cambiar tu propio rol (lo bloquea la base de datos)", false);
      cargar();
      return;
    }
    const { error } = await supabase.from("profiles").update({ [campo]: valor }).eq("id", u.id);
    if (error) avisar(error.message, false);
    else {
      avisar("Usuario actualizado");
      cargar();
    }
  };

  const crearEmpleado = async (e) => {
    e.preventDefault();
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", form.email.trim())
      .single();
    if (!prof) {
      avisar("Ese email aún no tiene cuenta (primero debe registrarse)", false);
      return;
    }
    const { error } = await supabase.from("empleados").insert({
      profile_id: prof.id,
      legajo: form.legajo || null,
      sucursal_id: form.sucursal_id || null,
    });
    if (error) avisar(error.message, false);
    else {
      avisar("Empleado registrado");
      setForm({ email: "", legajo: "", sucursal_id: "" });
      cargar();
    }
  };

  return (
    <section>
      <h2>Usuarios y empleados</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="tabs">
        <button className={tab === "usuarios" ? "activo" : ""} onClick={() => setTab("usuarios")}>
          Usuarios ({usuarios.length})
        </button>
        <button className={tab === "empleados" ? "activo" : ""} onClick={() => setTab("empleados")}>
          Empleados ({empleados.length})
        </button>
      </div>

      {tab === "usuarios" && (
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    {u.nombre} {u.apellido}
                  </td>
                  <td>
                    <select
                      value={u.roles?.id || ""}
                      onChange={(e) => guardarUsuario(u, "rol_id", e.target.value)}
                      disabled={u.id === profile.id}
                      title={u.id === profile.id ? "No puedes cambiar tu propio rol" : ""}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.estado}
                      onChange={(e) => guardarUsuario(u, "estado", e.target.value)}
                    >
                      {ESTADOS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "empleados" && (
        <>
          <form className="form-linea" onSubmit={crearEmpleado}>
            <input
              type="email"
              required
              placeholder="Email de la cuenta"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              placeholder="Legajo (opcional)"
              value={form.legajo}
              onChange={(e) => setForm({ ...form, legajo: e.target.value })}
            />
            <select
              value={form.sucursal_id}
              onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
            >
              <option value="">Sin sucursal</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <button type="submit">Agregar empleado</button>
          </form>

          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Legajo</th>
                  <th>Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((e) => (
                  <tr key={e.id}>
                    <td>{e.profiles?.email}</td>
                    <td>{e.legajo || "—"}</td>
                    <td>{e.sucursales?.nombre || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
