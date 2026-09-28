import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { listar, crear, actualizar } from "../../lib/db";

const VACIO = {
  sku: "", codigo_barras: "", nombre: "", descripcion: "",
  categoria_id: "", marca_id: "", unidad_id: "",
  precio_compra: "", precio_venta: "", impuesto_pct: 0,
  stock_minimo: 0, proveedor_id: "", estado: "activo",
};
const ESTADOS = ["activo", "inactivo", "discontinuado"];

export default function ProductsPage() {
  const [productos, setProductos] = useState([]);
  const [cats, setCats] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [nuevaCat, setNuevaCat] = useState("");
  const [nuevaMarca, setNuevaMarca] = useState("");

  const cargar = async () => {
    const [p, c, m, u] = await Promise.all([
      listar("productos", "*, categorias(nombre), marcas(nombre)", (x) =>
        x.order("nombre")),
      listar("categorias", "*", (x) => x.order("nombre")),
      listar("marcas", "*", (x) => x.order("nombre")),
      listar("unidades_medida"),
    ]);
    setProductos(p);
    setCats(c);
    setMarcas(m);
    setUnidades(u);
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
    const fila = {
      ...form,
      categoria_id: form.categoria_id || null,
      marca_id: form.marca_id || null,
      unidad_id: form.unidad_id || null,
      proveedor_id: form.proveedor_id || null,
      codigo_barras: form.codigo_barras || null,
      precio_compra: Number(form.precio_compra || 0),
      precio_venta: Number(form.precio_venta || 0),
      impuesto_pct: Number(form.impuesto_pct || 0),
      stock_minimo: Number(form.stock_minimo || 0),
    };
    try {
      if (form.id) await actualizar("productos", form.id, fila);
      else await crear("productos", fila);
      setForm(null);
      avisar("Producto guardado");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const subirImagen = async (productoId, archivo) => {
    const ruta = `productos/${new Date().getFullYear()}/${productoId}-${Date.now()}`;
    const { error } = await supabase.storage.from("productos").upload(ruta, archivo);
    if (error) {
      avisar(error.message, false);
      return;
    }
    const { data } = supabase.storage.from("productos").getPublicUrl(ruta);
    await crear("producto_imagenes", { producto_id: productoId, url: data.publicUrl });
    avisar("Imagen subida");
  };

  const agregarCat = async () => {
    if (!nuevaCat.trim()) return;
    try {
      await crear("categorias", { nombre: nuevaCat.trim() });
      setNuevaCat("");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const agregarMarca = async () => {
    if (!nuevaMarca.trim()) return;
    try {
      await crear("marcas", { nombre: nuevaMarca.trim() });
      setNuevaMarca("");
      cargar();
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const filtrados = productos.filter((p) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [p.nombre, p.sku, p.codigo_barras].join(" ").toLowerCase().includes(t);
  });

  return (
    <section>
      <h2>Productos ({filtrados.length})</h2>
      {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

      <div className="form-linea">
        <input
          placeholder="Buscar por nombre, SKU o código de barras…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={() => setForm({ ...VACIO })}>
          + Nuevo producto
        </button>
      </div>

      {form && (
        <form className="panel-form" onSubmit={guardar}>
          <h3>{form.id ? "Editar producto" : "Nuevo producto"}</h3>
          <div className="form-grid">
            <input required placeholder="SKU *" value={form.sku} onChange={set("sku")} />
            <input placeholder="Código de barras" value={form.codigo_barras || ""} onChange={set("codigo_barras")} />
            <input required placeholder="Nombre *" value={form.nombre} onChange={set("nombre")} />
            <select value={form.categoria_id || ""} onChange={set("categoria_id")}>
              <option value="">Sin categoría</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <select value={form.marca_id || ""} onChange={set("marca_id")}>
              <option value="">Sin marca</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
            <select value={form.unidad_id || ""} onChange={set("unidad_id")}>
              <option value="">Sin unidad</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.codigo}</option>
              ))}
            </select>
            <input type="number" step="0.01" min="0" placeholder="Precio compra" value={form.precio_compra} onChange={set("precio_compra")} />
            <input type="number" step="0.01" min="0" placeholder="Precio venta *" value={form.precio_venta} onChange={set("precio_venta")} />
            <input type="number" step="0.01" min="0" max="100" placeholder="Impuesto %" value={form.impuesto_pct} onChange={set("impuesto_pct")} />
            <input type="number" min="0" placeholder="Stock mínimo" value={form.stock_minimo} onChange={set("stock_minimo")} />
            <select value={form.estado} onChange={set("estado")}>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input placeholder="Descripción" value={form.descripcion || ""} onChange={set("descripcion")} />
          </div>
          <div className="form-acciones">
            <button type="submit">Guardar</button>
            <button type="button" className="secundario" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th className="num">Compra</th>
              <th className="num">Venta</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td><code>{p.sku}</code></td>
                <td>{p.nombre}</td>
                <td>{p.categorias?.nombre || "—"}</td>
                <td className="num">${Number(p.precio_compra).toLocaleString("es-AR")}</td>
                <td className="num"><strong>${Number(p.precio_venta).toLocaleString("es-AR")}</strong></td>
                <td><span className={`pill ${p.estado}`}>{p.estado}</span></td>
                <td className="acciones">
                  <button onClick={() => setForm({ ...p })}>Editar</button>
                  <label className="subir">
                    Foto
                    <input
                      type="file" accept="image/*" hidden
                      onChange={(e) => e.target.files[0] && subirImagen(p.id, e.target.files[0])}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subtitulo">Categorías y marcas</h3>
      <div className="form-linea">
        <input placeholder="Nueva categoría" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
        <button type="button" onClick={agregarCat}>Agregar</button>
      </div>
      <p className="chips">
        {cats.map((c) => (
          <span key={c.id} className="chip">{c.nombre}</span>
        ))}
      </p>
      <div className="form-linea">
        <input placeholder="Nueva marca" value={nuevaMarca} onChange={(e) => setNuevaMarca(e.target.value)} />
        <button type="button" onClick={agregarMarca}>Agregar</button>
      </div>
      <p className="chips">
        {marcas.map((m) => (
          <span key={m.id} className="chip">{m.nombre}</span>
        ))}
      </p>
    </section>
  );
}
