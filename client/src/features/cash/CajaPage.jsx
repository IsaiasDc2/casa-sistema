import { useEffect, useState } from "react";
import { listar, rpc } from "../../lib/db";

export default function CajaPage() {
  const [turnos, setTurnos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [actual, setActual] = useState(null);
  const [movs, setMovs] = useState([]);
  const [msg, setMsg] = useState(null);
  const [montoInicial, setMontoInicial] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [cierre, setCierre] = useState(null);

  const cargar = async () => {
    const [t, c] = await Promise.all([
      listar("turnos_caja", "*, cajas(nombre)", (x) => x.order("fecha_apertura", { ascending: false }).limit(30)),
      listar("cajas", "*, sucursales(nombre)", (x) => x.eq("activa", true)),
    ]);
    setTurnos(t);
    setCajas(c);
    const abierto = t.find((x) => x.estado === "abierta") || null;
    setActual(abierto);
    if (abierto) {
      setMovs(await listar("movimientos_caja", "*", (x) =>
        x.eq("turno_id", abierto.id).order("created_at", { ascending: false })));
    } else {
      setMovs([]);
    }
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const abrir = async (e) => {
    e.preventDefault();
    try {
      await rpc("abrir_turno", { p_caja: cajaId, p_monto: Number(montoInicial || 0) });
      setMontoInicial("");
      avisar("Caja abierta");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const cerrar = async (e) => {
    e.preventDefault();
    try {
      const r = await rpc("cerrar_turno", {
        p_turno: actual.id,
        p_contado: Number(contado),
        p_obs: obs || null,
      });
      setCierre(r);
      setContado("");
      setObs("");
      avisar(
        `Caja cerrada. Esperado $${r.esperado} · Contado $${r.contado} · Diferencia $${r.diferencia}`,
        Number(r.diferencia) === 0
      );
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const money = (v) => `$${Number(v || 0).toLocaleString("es-AR")}`;

  return (
    <section>
      <h2>Caja</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      {!actual ? (
        <form className="panel-form" onSubmit={abrir}>
          <h3>Abrir caja</h3>
          <div className="form-grid">
            <select required value={cajaId} onChange={(e) => setCajaId(e.target.value)}>
              <option value="">Caja…</option>
              {cajas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.sucursales?.nombre})
                </option>
              ))}
            </select>
            <input required type="number" step="0.01" min="0" placeholder="Monto inicial" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} />
          </div>
          <div className="form-acciones">
            <button type="submit">Abrir turno</button>
          </div>
        </form>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><small>Turno abierto</small><strong>{actual.cajas?.nombre}</strong></div>
            <div className="kpi"><small>Inicial</small><strong>{money(actual.monto_inicial)}</strong></div>
            <div className="kpi"><small>Movimientos</small><strong>{movs.length}</strong></div>
          </div>

          <h3 className="subtitulo">Movimientos del turno</h3>
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr><th>Hora</th><th>Tipo</th><th>Detalle</th><th className="num">Monto</th></tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleTimeString("es-AR")}</td>
                    <td><span className="pill">{m.tipo}</span></td>
                    <td>{m.descripcion || "—"}</td>
                    <td className="num" style={{ color: Number(m.monto) < 0 ? "#fca5a5" : "#86efac" }}>
                      {money(m.monto)}{m.es_efectivo ? "" : " (no efectivo)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form className="panel-form" onSubmit={cerrar}>
            <h3>Cierre y arqueo</h3>
            <div className="form-grid">
              <input required type="number" step="0.01" min="0" placeholder="Efectivo contado" value={contado} onChange={(e) => setContado(e.target.value)} />
              <input placeholder="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <div className="form-acciones">
              <button type="submit">Cerrar caja</button>
            </div>
          </form>

          {cierre && (
            <div className="panel-form">
              <h3>Resultado del arqueo</h3>
              <p>Esperado: <strong>{money(cierre.esperado)}</strong></p>
              <p>Contado: <strong>{money(cierre.contado)}</strong></p>
              <p>
                Diferencia:{" "}
                <strong style={{ color: Number(cierre.diferencia) === 0 ? "#86efac" : "#fca5a5" }}>
                  {money(cierre.diferencia)}
                </strong>
              </p>
            </div>
          )}
        </>
      )}

      <h3 className="subtitulo">Historial de turnos</h3>
      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Caja</th>
              <th>Apertura</th>
              <th>Cierre</th>
              <th className="num">Ventas</th>
              <th className="num">Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <td>{t.cajas?.nombre}</td>
                <td>{new Date(t.fecha_apertura).toLocaleString("es-AR")}</td>
                <td>{t.fecha_cierre ? new Date(t.fecha_cierre).toLocaleString("es-AR") : "—"}</td>
                <td className="num">{money(t.total_ventas)}</td>
                <td
                  className="num"
                  style={{ color: t.diferencia != null && Number(t.diferencia) !== 0 ? "#fca5a5" : undefined }}
                >
                  {t.diferencia != null ? money(t.diferencia) : "—"}
                </td>
                <td><span className="pill">{t.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
