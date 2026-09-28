import { useEffect, useState } from "react";
import { listar } from "../../lib/db";

export default function AuditPage() {
  const [filas, setFilas] = useState([]);
  const [tabla, setTabla] = useState("");
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    try {
      let q = (x) => x.order("created_at", { ascending: false }).limit(200);
      if (tabla) {
        const t = tabla;
        q = (x) => x.eq("tabla", t).order("created_at", { ascending: false }).limit(200);
      }
      setFilas(await listar("auditoria", "*, profiles(email)", q));
    } catch (e) {
      setMsg(e.message);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla]);

  return (
    <section>
      <h2>Auditoría (solo lectura)</h2>
      {msg && <p className="error">{msg}</p>}
      <p>
        Los registros son inmutables: ni siquiera un administrador puede
        modificarlos ni eliminarlos (sin políticas de escritura a nivel DB).
      </p>

      <div className="form-linea">
        <select value={tabla} onChange={(e) => setTabla(e.target.value)}>
          <option value="">Todas las tablas</option>
          {["productos", "ventas", "compras", "turnos_caja", "profiles", "devoluciones"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Tabla</th>
              <th>Registro</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.created_at).toLocaleString("es-AR")}</td>
                <td>{a.profiles?.email || "sistema"}</td>
                <td><span className="pill">{a.accion}</span></td>
                <td><code>{a.tabla}</code></td>
                <td><code>{a.registro_id?.slice(0, 8) || "—"}</code></td>
                <td>
                  <details>
                    <summary>ver cambios</summary>
                    <pre className="json">
                      {JSON.stringify({ antes: a.anteriores, despues: a.nuevos }, null, 1).slice(0, 600)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
