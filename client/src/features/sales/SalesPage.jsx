import { useEffect, useState } from "react";
import { listar, rpc } from "../../lib/db";

export default function SalesPage() {
  const [ventas, setVentas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    setVentas(
      await listar("ventas", "*, clientes(nombre,apellido)", (x) =>
        x.order("created_at", { ascending: false }).limit(100))
    );
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const ver = async (v) => {
    const [items, pagos] = await Promise.all([
      listar("venta_items", "*, productos(nombre)", (x) => x.eq("venta_id", v.id)),
      listar("venta_pagos", "monto,referencia,metodos_pago(nombre)", (x) => x.eq("venta_id", v.id)),
    ]);
    setDetalle({ ...v, items, pagos });
  };

  const anular = async () => {
    const motivo = window.prompt("Motivo de la anulación:");
    if (!motivo) return;
    try {
      await rpc("anular_venta", { p_venta: detalle.id, p_motivo: motivo });
      setDetalle(null);
      setMsg({ ok: true, texto: "Venta anulada y stock revertido" });
      cargar();
    } catch (e) {
      setMsg({ ok: false, texto: e.message });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const money = (v) => `$${Number(v || 0).toLocaleString("es-AR")}`;

  return (
    <section>
      <h2>Ventas</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th className="num">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td><code>{v.numero}</code></td>
                <td>{new Date(v.created_at).toLocaleString("es-AR")}</td>
                <td>{v.clientes ? `${v.clientes.nombre} ${v.clientes.apellido}` : "Consumidor final"}</td>
                <td><span className="pill">{v.estado}</span></td>
                <td className="num"><strong>{money(v.total)}</strong></td>
                <td className="acciones">
                  <button onClick={() => ver(v)}>Detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="panel-form">
          <h3>
            Venta {detalle.numero} <span className="pill">{detalle.estado}</span>
          </h3>
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr><th>Producto</th><th className="num">Cant.</th><th className="num">P. unit.</th><th className="num">Subtotal</th></tr>
              </thead>
              <tbody>
                {detalle.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.productos?.nombre}</td>
                    <td className="num">{i.cantidad}</td>
                    <td className="num">{money(i.precio_unitario)}</td>
                    <td className="num">{money(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Pagos: {detalle.pagos.map((p) => `${p.metodos_pago?.nombre} ${money(p.monto)}`).join(" · ")}</p>
          <div className="form-acciones">
            {detalle.estado === "pagada" && (
              <button type="button" onClick={anular}>Anular venta</button>
            )}
            <button type="button" className="secundario" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  );
}
