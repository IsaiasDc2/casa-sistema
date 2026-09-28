import { useEffect, useState } from "react";
import { listar, crear, rpc } from "../../lib/db";
import { supabase } from "../../lib/supabase";

export default function ReturnsPage() {
  const [devs, setDevs] = useState([]);
  const [ventaId, setVentaId] = useState("");
  const [venta, setVenta] = useState(null);
  const [sel, setSel] = useState({});
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    setDevs(
      await listar("devoluciones", "*, ventas(numero)", (x) =>
        x.order("created_at", { ascending: false }).limit(50))
    );
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const buscarVenta = async (e) => {
    e.preventDefault();
    try {
      const items = await listar("venta_items", "cantidad,precio_unitario,productos(id,nombre)", (x) =>
        x.eq("venta_id", ventaId));
      if (items.length === 0) {
        avisar("Venta inexistente o sin ítems", false);
        return;
      }
      const [v] = await listar("ventas", "numero,estado", (x) => x.eq("id", ventaId).limit(1));
      setVenta({ id: ventaId, numero: v.numero, estado: v.estado, items });
      const s = {};
      items.forEach((i) => {
        s[i.productos.id] = 0;
      });
      setSel(s);
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const solicitar = async (e) => {
    e.preventDefault();
    const filas = Object.entries(sel)
      .filter(([, c]) => Number(c) > 0)
      .map(([producto_id, cantidad]) => {
        const it = venta.items.find((i) => i.productos.id === producto_id);
        return { producto_id, cantidad: Number(cantidad), precio_unitario: Number(it.precio_unitario) };
      });
    if (filas.length === 0 || !motivo.trim()) {
      avisar("Seleccioná cantidades y escribí el motivo", false);
      return;
    }
    try {
      const turno = await listar("turnos_caja", "id", (x) =>
        x.eq("estado", "abierta").order("fecha_apertura", { ascending: false }).limit(1));
      const { data: dev } = await supabase
        .from("devoluciones")
        .insert({
          numero: `DEV-${Date.now()}`,
          tipo: "cliente",
          venta_id: venta.id,
          motivo: motivo.trim(),
          reintegro_monto: filas.reduce((a, f) => a + f.cantidad * f.precio_unitario, 0),
          turno_id: turno[0]?.id || null,
        })
        .select()
        .single();
      await supabase.from("devolucion_items").insert(
        filas.map((f) => ({ ...f, devolucion_id: dev.id }))
      );
      setVenta(null);
      setMotivo("");
      setVentaId("");
      avisar("Devolución solicitada (pendiente de aprobación)");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const cambiarEstado = async (id, estado) => {
    try {
      if (estado === "procesada") {
        await rpc("procesar_devolucion", { p_devolucion: id });
      } else {
        const { error } = await supabase.from("devoluciones").update({ estado }).eq("id", id);
        if (error) throw new Error(error.message);
      }
      avisar(`Devolución ${estado}`);
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  return (
    <section>
      <h2>Devoluciones</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <form className="form-linea" onSubmit={buscarVenta}>
        <input placeholder="ID de la venta (UUID del ticket)…" value={ventaId} onChange={(e) => setVentaId(e.target.value)} />
        <button type="submit">Buscar venta</button>
      </form>

      {venta && (
        <form className="panel-form" onSubmit={solicitar}>
          <h3>
            Devolver de {venta.numero} <span className="pill">{venta.estado}</span>
          </h3>
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr><th>Producto</th><th className="num">Vendido</th><th className="num">Devolver</th></tr>
              </thead>
              <tbody>
                {venta.items.map((i) => (
                  <tr key={i.productos.id}>
                    <td>{i.productos.nombre}</td>
                    <td className="num">{i.cantidad}</td>
                    <td className="num">
                      <input
                        type="number" step="0.001" min="0" max={Number(i.cantidad)}
                        value={sel[i.productos.id] ?? ""}
                        onChange={(e) => setSel({ ...sel, [i.productos.id]: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-grid">
            <input required placeholder="Motivo de la devolución *" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="form-acciones">
            <button type="submit">Solicitar devolución</button>
            <button type="button" className="secundario" onClick={() => setVenta(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr><th>Número</th><th>Tipo</th><th>Venta</th><th>Estado</th><th className="num">Reintegro</th><th></th></tr>
          </thead>
          <tbody>
            {devs.map((d) => (
              <tr key={d.id}>
                <td><code>{d.numero}</code></td>
                <td>{d.tipo}</td>
                <td>{d.ventas?.numero || "—"}</td>
                <td><span className="pill">{d.estado}</span></td>
                <td className="num">${Number(d.reintegro_monto).toLocaleString("es-AR")}</td>
                <td className="acciones">
                  {d.estado === "solicitada" && (
                    <>
                      <button onClick={() => cambiarEstado(d.id, "aprobada")}>Aprobar</button>
                      <button onClick={() => cambiarEstado(d.id, "rechazada")}>Rechazar</button>
                    </>
                  )}
                  {d.estado === "aprobada" && (
                    <button onClick={() => cambiarEstado(d.id, "procesada")}>Procesar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
