import { useEffect, useState } from "react";
import { listar, rpc } from "../../lib/db";

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [movs, setMovs] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [tab, setTab] = useState("stock");
  const [msg, setMsg] = useState(null);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [ajuste, setAjuste] = useState({ producto_id: "", deposito_id: "", cantidad: "", motivo: "" });
  const [transf, setTransf] = useState({ producto_id: "", origen: "", destino: "", cantidad: "", motivo: "" });

  const cargar = async () => {
    const [s, m, d] = await Promise.all([
      listar("stock", "cantidad, productos(id,nombre,sku,stock_minimo), depositos(id,nombre)"),
      listar("movimientos_stock", "*, productos(nombre)", (x) =>
        x.order("created_at", { ascending: false }).limit(100)),
      listar("depositos", "id,nombre"),
    ]);
    setStock(s);
    setMovs(m);
    setDepositos(d);
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = async (promesa, okTexto) => {
    try {
      await promesa;
      setMsg({ ok: true, texto: okTexto });
      cargar();
    } catch (e) {
      setMsg({ ok: false, texto: e.message });
    }
    setTimeout(() => setMsg(null), 3500);
  };

  const filas = soloAlertas
    ? stock.filter((s) => Number(s.cantidad) <= Number(s.productos?.stock_minimo ?? 0))
    : stock;

  return (
    <section>
      <h2>Inventario</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="tabs">
        {["stock", "ajustar", "transferir", "movimientos"].map((t) => (
          <button key={t} className={tab === t ? "activo" : ""} onClick={() => setTab(t)}>
            {t === "stock" ? `Stock (${filas.length})` : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <label className="check">
          <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
          Solo alertas
        </label>
      </div>

      {tab === "stock" && (
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Depósito</th>
                <th className="num">Cantidad</th>
                <th className="num">Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s, i) => {
                const bajo = Number(s.cantidad) <= Number(s.productos?.stock_minimo ?? 0);
                return (
                  <tr key={i} className={bajo ? "alerta" : ""}>
                    <td><code>{s.productos?.sku}</code></td>
                    <td>{s.productos?.nombre}</td>
                    <td>{s.depositos?.nombre}</td>
                    <td className="num"><strong>{s.cantidad}</strong></td>
                    <td className="num">{s.productos?.stock_minimo}</td>
                    <td>{bajo ? <span className="pill bajo">stock bajo</span> : <span className="pill ok-pill">ok</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ajustar" && (
        <form
          className="panel-form"
          onSubmit={(e) => {
            e.preventDefault();
            avisar(
              rpc("ajustar_stock", {
                p_producto: ajuste.producto_id,
                p_deposito: ajuste.deposito_id,
                p_nueva_cantidad: Number(ajuste.cantidad),
                p_motivo: ajuste.motivo,
              }),
              "Stock ajustado"
            );
            setAjuste({ producto_id: "", deposito_id: "", cantidad: "", motivo: "" });
          }}
        >
          <h3>Ajuste manual (requiere motivo)</h3>
          <div className="form-grid">
            <select required value={ajuste.producto_id} onChange={(e) => setAjuste({ ...ajuste, producto_id: e.target.value })}>
              <option value="">Producto…</option>
              {stock.map((s, i) => (
                <option key={i} value={s.productos?.id}>
                  {s.productos?.nombre} ({s.depositos?.nombre}: {s.cantidad})
                </option>
              ))}
            </select>
            <select required value={ajuste.deposito_id} onChange={(e) => setAjuste({ ...ajuste, deposito_id: e.target.value })}>
              <option value="">Depósito…</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
            <input required type="number" step="0.001" min="0" placeholder="Cantidad física contada" value={ajuste.cantidad} onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })} />
            <input required placeholder="Motivo (obligatorio)" value={ajuste.motivo} onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })} />
          </div>
          <div className="form-acciones">
            <button type="submit">Aplicar ajuste</button>
          </div>
        </form>
      )}

      {tab === "transferir" && (
        <form
          className="panel-form"
          onSubmit={(e) => {
            e.preventDefault();
            avisar(
              rpc("transferir_stock", {
                p_producto: transf.producto_id,
                p_origen: transf.origen,
                p_destino: transf.destino,
                p_cantidad: Number(transf.cantidad),
                p_motivo: transf.motivo || "Transferencia",
              }),
              "Transferencia registrada"
            );
            setTransf({ producto_id: "", origen: "", destino: "", cantidad: "", motivo: "" });
          }}
        >
          <h3>Transferencia entre depósitos</h3>
          <div className="form-grid">
            <select required value={transf.producto_id} onChange={(e) => setTransf({ ...transf, producto_id: e.target.value })}>
              <option value="">Producto…</option>
              {stock.map((s, i) => (
                <option key={i} value={s.productos?.id}>{s.productos?.nombre}</option>
              ))}
            </select>
            <select required value={transf.origen} onChange={(e) => setTransf({ ...transf, origen: e.target.value })}>
              <option value="">Origen…</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
            <select required value={transf.destino} onChange={(e) => setTransf({ ...transf, destino: e.target.value })}>
              <option value="">Destino…</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
            <input required type="number" step="0.001" min="0" placeholder="Cantidad" value={transf.cantidad} onChange={(e) => setTransf({ ...transf, cantidad: e.target.value })} />
            <input placeholder="Motivo" value={transf.motivo} onChange={(e) => setTransf({ ...transf, motivo: e.target.value })} />
          </div>
          <div className="form-acciones">
            <button type="submit">Transferir</button>
          </div>
        </form>
      )}

      {tab === "movimientos" && (
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="num">Cantidad</th>
                <th className="num">Resultante</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString("es-AR")}</td>
                  <td>{m.productos?.nombre}</td>
                  <td><span className="pill">{m.tipo}</span></td>
                  <td className="num" style={{ color: Number(m.cantidad) < 0 ? "#fca5a5" : "#86efac" }}>
                    {Number(m.cantidad) > 0 ? "+" : ""}{m.cantidad}
                  </td>
                  <td className="num">{m.stock_resultante}</td>
                  <td>{m.motivo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
