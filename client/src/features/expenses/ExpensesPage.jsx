import { useEffect, useState } from "react";
import { listar, rpc } from "../../lib/db";

export default function ExpensesPage() {
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ categoria_id: "", descripcion: "", monto: "", metodo_id: "" });

  const cargar = async () => {
    const [g, c, m] = await Promise.all([
      listar("gastos", "*, categorias_gasto(nombre), metodos_pago(nombre)", (x) =>
        x.order("created_at", { ascending: false }).limit(100)),
      listar("categorias_gasto", "*", (x) => x.eq("activa", true).order("nombre")),
      listar("metodos_pago", "*", (x) => x.eq("activo", true).order("nombre")),
    ]);
    setGastos(g);
    setCategorias(c);
    setMetodos(m);
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const turno = await listar("turnos_caja", "id", (x) =>
        x.eq("estado", "abierta").order("fecha_apertura", { ascending: false }).limit(1));
      if (!turno[0]) {
        avisar("No hay turno de caja abierto", false);
        return;
      }
      await rpc("registrar_gasto", {
        p_turno: turno[0].id,
        p_categoria: form.categoria_id || null,
        p_descripcion: form.descripcion,
        p_monto: Number(form.monto),
        p_metodo: form.metodo_id,
      });
      setForm({ categoria_id: "", descripcion: "", monto: "", metodo_id: "" });
      avisar("Gasto registrado en caja");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const total = gastos.reduce((a, g) => a + Number(g.monto), 0);

  return (
    <section>
      <h2>Gastos · Total ${total.toLocaleString("es-AR")}</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <form className="panel-form" onSubmit={guardar}>
        <h3>Nuevo gasto (afecta la caja abierta)</h3>
        <div className="form-grid">
          <select required value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
            <option value="">Categoría…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <input required placeholder="Descripción *" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <input required type="number" step="0.01" min="0" placeholder="Importe *" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          <select required value={form.metodo_id} onChange={(e) => setForm({ ...form, metodo_id: e.target.value })}>
            <option value="">Método de pago…</option>
            {metodos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>
        <div className="form-acciones">
          <button type="submit">Registrar gasto</button>
        </div>
      </form>

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Método</th><th className="num">Monto</th></tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{new Date(g.created_at).toLocaleString("es-AR")}</td>
                <td>{g.categorias_gasto?.nombre || "—"}</td>
                <td>{g.descripcion}</td>
                <td>{g.metodos_pago?.nombre}</td>
                <td className="num">${Number(g.monto).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
