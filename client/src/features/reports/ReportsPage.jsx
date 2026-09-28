import { useEffect, useState } from "react";
import { listar } from "../../lib/db";
import { supabase } from "../../lib/supabase";

const REPORTES = {
  ventas_dia: { titulo: "Ventas por día", vista: "v_ventas_dia", fecha: "dia" },
  top_productos: { titulo: "Productos más vendidos", vista: "v_top_productos", fecha: null },
  ventas_vendedor: { titulo: "Ventas por vendedor", vista: "v_ventas_vendedor", fecha: "dia" },
  stock_bajo: { titulo: "Stock bajo", vista: "v_stock_bajo", fecha: null },
  valorizacion: { titulo: "Inventario valorizado", vista: "v_valorizacion", fecha: null },
  saldos_cc: { titulo: "Saldos de cuentas corrientes", vista: "v_saldos_cc", fecha: null },
  compras_proveedor: { titulo: "Compras por proveedor", vista: "v_compras_proveedor", fecha: "dia" },
};

const hoy = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [tipo, setTipo] = useState("ventas_dia");
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [filas, setFilas] = useState([]);
  const [msg, setMsg] = useState(null);

  const generar = async () => {
    try {
      const cfg = REPORTES[tipo];
      let q = supabase.from(cfg.vista).select("*");
      if (cfg.fecha) q = q.gte(cfg.fecha, desde).lte(cfg.fecha, hasta);
      const { data, error } = await q.limit(500);
      if (error) throw new Error(error.message);
      setFilas(data || []);
    } catch (e) {
      setMsg({ ok: false, texto: e.message });
      setTimeout(() => setMsg(null), 4000);
    }
  };

  useEffect(() => {
    generar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const columnas = filas.length > 0 ? Object.keys(filas[0]) : [];

  const csv = () => {
    if (filas.length === 0) return;
    const head = columnas.join(";");
    const body = filas.map((f) => columnas.map((c) => JSON.stringify(f[c] ?? "")).join(";")).join("\n");
    const blob = new Blob([`﻿${head}\n${body}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${tipo}-${desde}-${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const celda = (v) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") return v.toLocaleString("es-AR");
    return String(v);
  };

  return (
    <section>
      <h2>Reportes</h2>
      {msg && <p className="error">{msg.texto}</p>}

      <div className="form-linea">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(REPORTES).map(([k, r]) => (
            <option key={k} value={k}>{r.titulo}</option>
          ))}
        </select>
        {REPORTES[tipo].fecha && (
          <>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </>
        )}
        <button type="button" onClick={generar}>Generar</button>
        <button type="button" className="secundario" onClick={csv} disabled={filas.length === 0}>
          Exportar CSV
        </button>
      </div>

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c}>{c.replaceAll("_", " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {columnas.map((c) => (
                  <td key={c}>{celda(f[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length === 0 && <p className="error">Sin datos para el período.</p>}
    </section>
  );
}
