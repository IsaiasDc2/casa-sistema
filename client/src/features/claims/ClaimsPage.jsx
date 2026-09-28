import { useEffect, useState } from "react";
import { listar, crear } from "../../lib/db";
import { supabase } from "../../lib/supabase";

const ESTADOS = ["abierto", "en_revision", "respondido", "resuelto", "rechazado"];

export default function ClaimsPage() {
  const [reclamos, setReclamos] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [form, setForm] = useState(null);
  const [nuevoMsg, setNuevoMsg] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    setReclamos(
      await listar("reclamos", "*, clientes(nombre,apellido), ventas(numero)", (x) =>
        x.order("created_at", { ascending: false }).limit(100))
    );
  };

  useEffect(() => {
    cargar().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const ver = async (r) => {
    setDetalle(r);
    setMensajes(
      await listar("reclamo_mensajes", "*", (x) =>
        x.eq("reclamo_id", r.id).order("created_at"))
    );
  };

  const crearReclamo = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await crear("reclamos", {
        motivo: f.get("motivo"),
        venta_id: f.get("venta_id") || null,
        cliente_id: f.get("cliente_id") || null,
        producto_id: f.get("producto_id") || null,
      });
      setForm(null);
      avisar("Reclamo creado");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const cambiarEstado = async (estado) => {
    const { error } = await supabase.from("reclamos").update({ estado }).eq("id", detalle.id);
    if (error) avisar(error.message, false);
    else {
      avisar(`Reclamo ${estado}`);
      setDetalle({ ...detalle, estado });
      cargar();
    }
  };

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!nuevoMsg.trim() && !archivo) return;
    try {
      let evidencia = null;
      if (archivo) {
        const ruta = `reclamos/${new Date().getFullYear()}/${detalle.id}-${Date.now()}`;
        const { error } = await supabase.storage.from("reclamos").upload(ruta, archivo);
        if (error) throw new Error(error.message);
        evidencia = ruta;
      }
      await crear("reclamo_mensajes", {
        reclamo_id: detalle.id,
        mensaje: nuevoMsg.trim() || "(adjunto)",
        evidencia_url: evidencia,
      });
      setNuevoMsg("");
      setArchivo(null);
      ver(detalle);
    } catch (err) {
      avisar(err.message, false);
    }
  };

  return (
    <section>
      <h2>Reclamos ({reclamos.length})</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="form-linea">
        <button type="button" onClick={() => setForm((v) => !v)}>
          {form ? "Cancelar" : "+ Nuevo reclamo"}
        </button>
      </div>

      {form && (
        <form className="panel-form" onSubmit={crearReclamo}>
          <h3>Nuevo reclamo</h3>
          <div className="form-grid">
            <input name="motivo" required placeholder="Motivo *" />
            <input name="venta_id" placeholder="ID de venta (UUID, opcional)" />
            <input name="cliente_id" placeholder="ID de cliente (UUID, opcional)" />
            <input name="producto_id" placeholder="ID de producto (UUID, opcional)" />
          </div>
          <div className="form-acciones">
            <button type="submit">Crear reclamo</button>
          </div>
        </form>
      )}

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Motivo</th>
              <th>Venta</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reclamos.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString("es-AR")}</td>
                <td>{r.motivo}</td>
                <td>{r.ventas?.numero || "—"}</td>
                <td>{r.clientes ? `${r.clientes.nombre} ${r.clientes.apellido}` : "—"}</td>
                <td><span className="pill">{r.estado}</span></td>
                <td className="acciones">
                  <button onClick={() => ver(r)}>Ver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="panel-form">
          <h3>
            Reclamo <span className="pill">{detalle.estado}</span>
          </h3>
          <p>{detalle.motivo}</p>

          <div className="form-linea">
            {ESTADOS.filter((s) => s !== detalle.estado).map((s) => (
              <button key={s} type="button" className="secundario" onClick={() => cambiarEstado(s)}>
                → {s}
              </button>
            ))}
            <button type="button" className="secundario" onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>

          <h3 className="subtitulo">Mensajes</h3>
          {mensajes.map((m) => (
            <p key={m.id}>
              <small>{new Date(m.created_at).toLocaleString("es-AR")}</small> — {m.mensaje}{" "}
              {m.evidencia_url && <em>(con evidencia)</em>}
            </p>
          ))}

          <form className="form-linea" onSubmit={enviarMensaje}>
            <input
              placeholder="Escribir respuesta…"
              value={nuevoMsg}
              onChange={(e) => setNuevoMsg(e.target.value)}
            />
            <label className="subir">
              Evidencia
              <input type="file" hidden onChange={(e) => setArchivo(e.target.files[0] || null)} />
            </label>
            <button type="submit">Enviar</button>
          </form>
          {archivo && <p><small>Adjunto: {archivo.name}</small></p>}
        </div>
      )}
    </section>
  );
}
