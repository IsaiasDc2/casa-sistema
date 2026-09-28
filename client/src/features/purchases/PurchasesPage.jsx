import { useEffect, useState } from "react";
import { listar, crear, rpc } from "../../lib/db";import { supabase } from "../../lib/supabase";

export default function PurchasesPage() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [tab, setTab] = useState("lista");
  const [detalle, setDetalle] = useState(null);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);
  const [nueva, setNueva] = useState({ proveedor_id: "", items: [{ producto_id: "", cantidad: "", costo: "" }] });
  const [recepcion, setRecepcion] = useState({});
  const [deposito, setDeposito] = useState("");

  const cargar = async () => {
    const [c, p, pr, d] = await Promise.all([
      listar("compras", "*, proveedores(razon_social)", (x) => x.order("created_at", { ascending: false }).limit(50)),
      listar("proveedores", "id,razon_social", (x) => x.order("razon_social")),
      listar("productos", "id,nombre,sku,precio_compra", (x) => x.eq("estado", "activo").order("nombre")),
      listar("depositos", "id,nombre", (x) => x.eq("activo", true)),
    ]);
    setCompras(c);
    setProveedores(p);
    setProductos(pr);
    if (!deposito && d[0]) setDeposito(d[0].id);
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const setItemNueva = (i, k, v) => {
    const copia = [...nueva.items];
    copia[i] = { ...copia[i], [k]: v };
    setNueva({ ...nueva, items: copia });
  };

  const crearOrden = async (e) => {
    e.preventDefault();
    const filas = nueva.items.filter((i) => i.producto_id && Number(i.cantidad) > 0);
    if (!nueva.proveedor_id || filas.length === 0) {
      avisar("Proveedor y al menos un producto con cantidad", false);
      return;
    }
    try {
      const subtotal = filas.reduce((a, i) => a + Number(i.cantidad) * Number(i.costo || 0), 0);
      const { data: compra } = await supabase
        .from("compras")
        .insert({
          numero: `OC-${Date.now()}`,
          proveedor_id: nueva.proveedor_id,
          subtotal: Math.round(subtotal * 100) / 100,
          total: Math.round(subtotal * 100) / 100,
          estado: "pendiente",
        })
        .select()
        .single();
      if (!compra) throw new Error("No se pudo crear la orden");
      await supabase.from("compra_items").insert(
        filas.map((i) => ({
          compra_id: compra.id,
          producto_id: i.producto_id,
          cantidad: Number(i.cantidad),
          costo_unitario: Number(i.costo || 0),
          subtotal: Math.round(Number(i.cantidad) * Number(i.costo || 0) * 100) / 100,
        }))
      );
      setNueva({ proveedor_id: "", items: [{ producto_id: "", cantidad: "", costo: "" }] });
      setTab("lista");
      avisar("Orden creada en estado pendiente");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const verDetalle = async (c) => {
    const items = await listar("compra_items", "*, productos(nombre)", (x) => x.eq("compra_id", c.id));
    setDetalle({ ...c, items });
    const rec = {};
    items.forEach((i) => {
      rec[i.producto_id] = Number(i.cantidad) - Number(i.cantidad_recibida);
    });
    setRecepcion(rec);
  };

  const registrarDeuda = async () => {
    try {
      let cuentas = await listar("cuentas_corrientes", "id", (x) =>
        x.eq("tipo", "proveedor").eq("proveedor_id", detalle.proveedor_id).limit(1));
      if (!cuentas[0]) {
        cuentas = [await crear("cuentas_corrientes", { tipo: "proveedor", proveedor_id: detalle.proveedor_id })];
      }
      await rpc("registrar_movimiento_cc", {
        p_cuenta: cuentas[0].id,
        p_tipo: "cargo",
        p_monto: Number(detalle.total),
        p_concepto: `Compra ${detalle.numero} a crédito`,
        p_ref_tipo: "compra",
        p_ref_id: detalle.id,
      });
      avisar("Deuda registrada en cuenta corriente del proveedor");
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const recibir = async () => {
    const filas = Object.entries(recepcion)
      .filter(([, cant]) => Number(cant) > 0)
      .map(([producto_id, cantidad]) => ({ producto_id, cantidad: Number(cantidad) }));
    if (filas.length === 0) {
      avisar("Indicá cantidades a recibir", false);
      return;
    }
    try {
      await rpc("recibir_compra", { p_compra: detalle.id, p_deposito: deposito, p_items: filas });
      avisar("Mercadería ingresada al stock");
      setDetalle(null);
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  return (
    <section>
      <h2>Compras</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="tabs">
        <button className={tab === "lista" ? "activo" : ""} onClick={() => setTab("lista")}>
          Órdenes ({compras.length})
        </button>
        <button className={tab === "nueva" ? "activo" : ""} onClick={() => setTab("nueva")}>
          Nueva orden
        </button>
      </div>

      {tab === "lista" && (
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id}>
                  <td><code>{c.numero}</code></td>
                  <td>{c.proveedores?.razon_social}</td>
                  <td>{new Date(c.created_at).toLocaleDateString("es-AR")}</td>
                  <td><span className="pill">{c.estado}</span></td>
                  <td className="num"><strong>${Number(c.total).toLocaleString("es-AR")}</strong></td>
                  <td className="acciones">
                    <button onClick={() => verDetalle(c)}>Recibir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "nueva" && (
        <form className="panel-form" onSubmit={crearOrden}>
          <h3>Nueva orden de compra</h3>
          <div className="form-grid">
            <select required value={nueva.proveedor_id} onChange={(e) => setNueva({ ...nueva, proveedor_id: e.target.value })}>
              <option value="">Proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.razon_social}</option>
              ))}
            </select>
          </div>
          {nueva.items.map((it, i) => (
            <div className="form-grid" key={i}>
              <select value={it.producto_id} onChange={(e) => setItemNueva(i, "producto_id", e.target.value)}>
                <option value="">Producto…</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>
                ))}
              </select>
              <input type="number" step="0.001" min="0" placeholder="Cantidad" value={it.cantidad} onChange={(e) => setItemNueva(i, "cantidad", e.target.value)} />
              <input type="number" step="0.01" min="0" placeholder="Costo unit." value={it.costo} onChange={(e) => setItemNueva(i, "costo", e.target.value)} />
            </div>
          ))}
          <div className="form-acciones">
            <button type="button" className="secundario" onClick={() => setNueva({ ...nueva, items: [...nueva.items, { producto_id: "", cantidad: "", costo: "" }] })}>
              + Ítem
            </button>
            <button type="submit">Crear orden</button>
          </div>
        </form>
      )}

      {detalle && (
        <div className="panel-form">
          <h3>
            Recepción — {detalle.numero}
            {" · "}<span className="pill">{detalle.estado}</span>
          </h3>
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr><th>Producto</th><th className="num">Pedida</th><th className="num">Recibida</th><th className="num">Recibir ahora</th></tr>
              </thead>
              <tbody>
                {detalle.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.productos?.nombre}</td>
                    <td className="num">{i.cantidad}</td>
                    <td className="num">{i.cantidad_recibida}</td>
                    <td className="num">
                      <input
                        type="number" step="0.001" min="0"
                        max={Number(i.cantidad) - Number(i.cantidad_recibida)}
                        value={recepcion[i.producto_id] ?? ""}
                        onChange={(e) => setRecepcion({ ...recepcion, [i.producto_id]: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-acciones">
            <button type="button" onClick={recibir}>Confirmar recepción</button>
            <button type="button" className="secundario" onClick={registrarDeuda}>Registrar deuda</button>
            <button type="button" className="secundario" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  );
}
