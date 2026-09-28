import { useEffect, useState } from "react";
import { listar, crear, actualizar, rpc } from "../../lib/db";
const VACIO = {
  razon_social: "", nombre_comercial: "", identificacion_fiscal: "",
  telefono: "", email: "", direccion: "", contacto: "", condiciones_pago: "",
};

export default function SuppliersPage() {
  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [movs, setMovs] = useState([]);
  const [pago, setPago] = useState({ monto: "", concepto: "" });
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    setProveedores(await listar("proveedores", "*", (x) => x.order("razon_social")));
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
      const fila = { ...form, identificacion_fiscal: form.identificacion_fiscal || null };
      if (form.id) await actualizar("proveedores", form.id, fila);
      else await crear("proveedores", fila);
      setForm(null);
      avisar("Proveedor guardado");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const verCuenta = async (p) => {
    try {
      const cuentas = await listar("cuentas_corrientes", "id,saldo", (x) =>
        x.eq("tipo", "proveedor").eq("proveedor_id", p.id).limit(1));
      const cuenta = cuentas[0] || null;
      const movimientos = cuenta
        ? await listar("movimientos_cc", "*", (x) =>
            x.eq("cuenta_id", cuenta.id).order("created_at", { ascending: false }))
        : [];
      setMovs(movimientos);
      setDetalle({ ...p, saldo: cuenta?.saldo ?? 0, cuenta_id: cuenta?.id || null });
    } catch (e) {
      avisar(e.message, false);
    }
  };

  const abrirCuenta = async () => {
    try {
      await crear("cuentas_corrientes", { tipo: "proveedor", proveedor_id: detalle.id });
      avisar("Cuenta corriente abierta");
      verCuenta({ ...detalle });
    } catch (e) {
      avisar(e.message, false);
    }
  };

  const registrarPago = async (e) => {
    e.preventDefault();
    if (!detalle.cuenta_id) {
      avisar("Este proveedor aún no tiene cuenta corriente", false);
      return;
    }
    try {
      await rpc("registrar_movimiento_cc", {
        p_cuenta: detalle.cuenta_id,
        p_tipo: "pago",
        p_monto: Number(pago.monto),
        p_concepto: pago.concepto || "Pago a proveedor",
      });
      setPago({ monto: "", concepto: "" });
      avisar("Pago registrado");
      verCuenta({ ...detalle });
    } catch (err) {
      avisar(err.message, false);
    }
  };

  return (
    <section>
      <h2>Proveedores ({proveedores.length})</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="form-linea">
        <button type="button" onClick={() => setForm({ ...VACIO })}>+ Nuevo proveedor</button>
      </div>

      {form && (
        <form className="panel-form" onSubmit={guardar}>
          <h3>{form.id ? "Editar proveedor" : "Nuevo proveedor"}</h3>
          <div className="form-grid">
            <input required placeholder="Razón social *" value={form.razon_social} onChange={set("razon_social")} />
            <input placeholder="Nombre comercial" value={form.nombre_comercial || ""} onChange={set("nombre_comercial")} />
            <input placeholder="CUIT / identificación fiscal" value={form.identificacion_fiscal || ""} onChange={set("identificacion_fiscal")} />
            <input placeholder="Contacto" value={form.contacto || ""} onChange={set("contacto")} />
            <input placeholder="Teléfono" value={form.telefono || ""} onChange={set("telefono")} />
            <input type="email" placeholder="Email" value={form.email || ""} onChange={set("email")} />
            <input placeholder="Dirección" value={form.direccion || ""} onChange={set("direccion")} />
            <input placeholder="Condiciones de pago" value={form.condiciones_pago || ""} onChange={set("condiciones_pago")} />
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
              <th>Razón social</th>
              <th>Identificación</th>
              <th>Contacto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td>{p.razon_social}</td>
                <td>{p.identificacion_fiscal || "—"}</td>
                <td>{p.contacto || p.telefono || "—"}</td>
                <td className="acciones">
                  <button onClick={() => setForm({ ...p })}>Editar</button>
                  <button onClick={() => verCuenta(p)}>Cuenta</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="panel-form">
          <h3>
            Cuenta corriente — {detalle.razon_social}
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
