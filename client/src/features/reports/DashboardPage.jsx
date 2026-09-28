import { useEffect, useState } from "react";
import { listar } from "../../lib/db";

const hoy = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    (async () => {
      const [dia, bajo, top, turnos] = await Promise.all([
        listar("v_ventas_dia", "*", (x) => x.eq("dia", hoy())),
        listar("v_stock_bajo", "id"),
        listar("v_top_productos", "nombre,cantidad,total", (x) =>
          x.order("cantidad", { ascending: false }).limit(5)),
        listar("turnos_caja", "id", (x) => x.eq("estado", "abierta")),
      ]);
      const totalDia = dia.reduce((a, d) => a + Number(d.total), 0);
      const nDia = dia.reduce((a, d) => a + Number(d.cantidad), 0);
      setKpis({
        totalDia,
        nDia,
        ticket: nDia ? totalDia / nDia : 0,
        bajo: bajo.length,
        top,
        turnosAbiertos: turnos.length,
      });
    })().catch(() => setKpis({ error: true }));
  }, []);

  if (!kpis) return <p>Cargando…</p>;
  if (kpis.error) return <p className="error">Sin datos todavía.</p>;

  const money = (v) => `$${Number(v || 0).toLocaleString("es-AR")}`;

  return (
    <section>
      <h2>Dashboard</h2>
      <div className="kpis">
        <div className="kpi"><small>Ventas hoy</small><strong>{money(kpis.totalDia)}</strong></div>
        <div className="kpi"><small>Tickets hoy</small><strong>{kpis.nDia}</strong></div>
        <div className="kpi"><small>Ticket promedio</small><strong>{money(kpis.ticket)}</strong></div>
        <div className="kpi alerta"><small>Stock bajo</small><strong>{kpis.bajo}</strong></div>
        <div className="kpi"><small>Cajas abiertas</small><strong>{kpis.turnosAbiertos}</strong></div>
      </div>

      <h3 className="subtitulo">Más vendidos</h3>
      <div className="tabla-wrap">
        <table>
          <thead>
            <tr><th>Producto</th><th className="num">Cantidad</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {kpis.top.map((t, i) => (
              <tr key={i}>
                <td>{t.nombre}</td>
                <td className="num">{t.cantidad}</td>
                <td className="num">{money(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
