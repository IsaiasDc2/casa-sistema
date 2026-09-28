import { useEffect, useState } from "react";
import { listar, crear, actualizar, rpc } from "../../lib/db";

const VACIO = { nombre: "", apellido: "", documento: "", telefono: "", email: "", direccion: "" };

export default function CustomersPage() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [movs, setMovs] = useState([]);
  const [pago, setPago] = useState({ monto: "", concepto: "" });
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");

  const cargar = async () => {
    setClientes(await listar("clientes", "*", (x) => x.order("nombre")));
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await actualizar("clientes", form.id, { ...form, documento: form.documento || null });
      else await crear("clientes", { ...form, documento: form.documento || null });
      setForm(null);
      avisar("Cliente guardado");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const verCuenta = async (c) => {
    try {
      const cuentas = await listar("cuentas_corrientes", "id,saldo", (x) =>
        x.eq("tipo", "cliente").eq("cliente_id", c.id).limit(1));
      const cuenta = cuentas[0] || null;
      const movimientos = cuenta
        ? await listar("movimientos_cc", "*", (x) =>
            x.eq("cuenta_id", cuenta.id).order("created_at", { ascending: false }))
        : [];
      setMovs(movimientos);
      setDetalle({ ...c, saldo: cuenta?.saldo ?? 0, cuenta_id: cuenta?.id || null });
    } catch (e) {
      avisar(e.message, false);
    }
  };

  const abrirCuenta = async () => {
    try {
      await crear("cuentas_corrientes", { tipo: "cliente", cliente_id: detalle.id });
      avisar("Cuenta corriente abierta");
      verCuenta({ ...detalle });
    } catch (e) {
      avisar(e.message, false);
    }
  };

  const registrarPago = async (e) => {
    e.preventDefault();
    if (!detalle.cuenta_id) {
      avisar("Este cliente aún no tiene cuenta corriente", false);
      return;
    }
    try {
      await rpc("registrar_movimiento_cc", {
        p_cuenta: detalle.cuenta_id,
        p_tipo: "pago",
        p_monto: Number(pago.monto),
        p_concepto: pago.concepto || "Pago",
      });
      setPago({ monto: "", concepto: "" });
      avisar("Pago registrado");
      verCuenta({ ...detalle });
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const filtrados = clientes.filter((c) =>
    [c.nombre, c.apellido, c.documento].join(" ").toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <section>
      <h2>Clientes ({filtrados.length})</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="form-linea">
        <input placeholder="Buscar por nombre o documento…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={() => setForm({ ...VACIO })}>+ Nuevo cliente</button>
      </div>

      {form && (
        <form className="panel-form" onSubmit={guardar}>
          <h3>{form.id ? "Editar cliente" : "Nuevo cliente"}</h3>
          <div className="form-grid">
            <input required placeholder="Nombre *" value={form.nombre} onChange={set("nombre")} />
            <input placeholder="Apellido" value={form.apellido} onChange={set("apellido")} />
            <input placeholder="Documento" value={form.documento || ""} onChange={set("documento")} />
            <input placeholder="Teléfono" value={form.telefono || ""} onChange={set("telefono")} />
            <input type="email" placeholder="Email" value={form.email || ""} onChange={set("email")} />
            <input placeholder="Dirección" value={form.direccion || ""} onChange={set("direccion")} />
          </div>
          <div className="form-acciones">
            <button type="submit">Guardar</button>
            <button type="button" className="secundario" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Teléfono</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre} {c.apellido}</td>
                <td>{c.documento || "—"}</td>
                <td>{c.telefono || "—"}</td>
                <td className="acciones">
                  <button onClick={() => setForm({ ...c })}>Editar</button>
                  <button onClick={() => verCuenta(c)}>Cuenta</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="panel-form">
          <h3>
            Cuenta corriente — {detalle.nombre} {detalle.apellido}
            {" · "}Saldo: <strong>${Number(detalle.saldo || 0).toLocaleString("es-AR")}</strong>
          </h3>
          {!detalle.cuenta_id && (
            <div className="form-acciones">
              <button type="button" onClick={abrirCuenta}>Abrir cuenta corriente</button>
            </div>
          )}
          <form className="form-linea" onSubmit={registrarPago}>
            <input required type="number" step="0.01" min="0" placeholder="Monto del pago" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} />
            <input placeholder="Concepto" value={pago.concepto} onChange={(e) => setPago({ ...pago, concepto: e.target.value })} />
            <button type="submit">Registrar pago</button>
            <button type="button" className="secundario" onClick={() => setDetalle(null)}>Cerrar</button>
          </form>
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th className="num">Monto</th></tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString("es-AR")}</td>
                    <td><span className="pill">{m.tipo}</span></td>
                    <td>{m.concepto}</td>
                    <td className="num">${Number(m.monto).toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
