import { useEffect, useState } from "react";
import { listar, crear, actualizar } from "../../lib/db";
import { supabase } from "../../lib/supabase";

export default function ConfigPage() {
  const [config, setConfig] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [nuevoMetodo, setNuevoMetodo] = useState("");

  const cargar = async () => {
    const [c, m] = await Promise.all([
      listar("configuracion", "*", (x) => x.order("clave")),
      listar("metodos_pago", "*", (x) => x.order("nombre")),
    ]);
    setConfig(c);
    setMetodos(m);
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const guardarValor = async (clave, valor) => {
    const { error } = await supabase.from("configuracion").update({ valor }).eq("clave", clave);
    if (error) avisar(error.message, false);
    else avisar("Configuración guardada");
  };

  const toggleMetodo = async (m) => {
    await actualizar("metodos_pago", m.id, { activo: !m.activo });
    cargar();
  };

  const agregarMetodo = async (e) => {
    e.preventDefault();
    if (!nuevoMetodo.trim()) return;
    try {
      await crear("metodos_pago", { nombre: nuevoMetodo.trim() });
      setNuevoMetodo("");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  return (
    <section>
      <h2>Configuración</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <h3 className="subtitulo">Negocio y sistema</h3>
      <div className="tabla-wrap">
        <table>
          <thead>
            <tr><th>Clave</th><th>Valor</th><th></th></tr>
          </thead>
          <tbody>
            {config.map((c) => (
              <tr key={c.clave}>
                <td><code>{c.clave}</code></td>
                <td>
                  <input
                    defaultValue={c.valor}
                    id={`cfg-${c.clave}`}
                    placeholder={c.descripcion || ""}
                  />
                </td>
                <td>
                  <button
                    onClick={() =>
                      guardarValor(c.clave, document.getElementById(`cfg-${c.clave}`).value)
                    }
                  >
                    Guardar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subtitulo">Métodos de pago</h3>
      <form className="form-linea" onSubmit={agregarMetodo}>
        <input
          placeholder="Nuevo método (ej. Mercado Pago)"
          value={nuevoMetodo}
          onChange={(e) => setNuevoMetodo(e.target.value)}
        />
        <button type="submit">Agregar</button>
      </form>
      <div className="tabla-wrap">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Efectivo</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {metodos.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td>
                <td>{m.es_efectivo ? "sí" : "no"}</td>
                <td><span className="pill">{m.activo ? "activo" : "inactivo"}</span></td>
                <td>
                  <button onClick={() => toggleMetodo(m)}>
                    {m.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
