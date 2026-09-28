import { useEffect, useMemo, useRef, useState } from "react";
import { listar, rpc, crear } from "../../lib/db";
import { supabase } from "../../lib/supabase";

const BORRADORES_KEY = "casa-isaias-borradores";

export default function PosPage() {
  const [turno, setTurno] = useState(null);
  const [empleado, setEmpleado] = useState(null);
  const [metodos, setMetodos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [items, setItems] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState(null);
  const [descGlobal, setDescGlobal] = useState("");
  const [pagos, setPagos] = useState([]);
  const [recibido, setRecibido] = useState("");
  const [ticket, setTicket] = useState(null);
  const [suspendidas, setSuspendidas] = useState([]);
  const [msg, setMsg] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const buscarRef = useRef(null);

  const cargarBase = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const [t, m, c, e] = await Promise.all([
      listar("turnos_caja", "id,monto_inicial,cajas(nombre)", (x) =>
        x.eq("estado", "abierta").order("fecha_apertura", { ascending: false }).limit(1)),
      listar("metodos_pago", "*", (x) => x.eq("activo", true).order("nombre")),
      listar("clientes", "id,nombre,apellido", (x) => x.eq("estado", "activo").order("nombre").limit(100)),
      listar("empleados", "id", (x) => x.eq("profile_id", user.id).limit(1)),
    ]);
    setTurno(t[0] || null);
    setMetodos(m);
    setClientes(c);
    setEmpleado(e[0] || null);
    setSuspendidas(JSON.parse(localStorage.getItem(BORRADORES_KEY) || "[]"));
  };

  useEffect(() => {
    cargarBase().catch((e) => setMsg({ ok: false, texto: e.message }));
  }, []);

  const avisar = (texto, ok = true) => {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  // Atajos: F2 buscar, F9 ir a cobrar
  useEffect(() => {
    const teclas = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        buscarRef.current?.focus();
      }
      if (e.key === "F9") {
        e.preventDefault();
        document.getElementById("pos-cobrar")?.focus();
      }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, []);

  const buscar = async (texto) => {
    setBusqueda(texto);
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = texto.trim();
    const exactos = await listar("productos", "*", (x) =>
      x.eq("estado", "activo").or(`sku.eq.${t},codigo_barras.eq.${t}`).limit(5)).catch(() => []);
    if (exactos.length > 0) {
      agregar(exactos[0]);
      setBusqueda("");
      setResultados([]);
      return;
    }
    const res = await listar("productos", "*", (x) =>
      x.eq("estado", "activo").ilike("nombre", `%${t}%`).limit(8)).catch(() => []);
    setResultados(res);
  };

  const agregar = (p) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.producto_id === p.id);
      if (ex) {
        return prev.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: Number(i.cantidad) + 1 } : i);
      }
      return [...prev, {
        producto_id: p.id, nombre: p.nombre,
        precio: Number(p.precio_venta), impuesto_pct: Number(p.impuesto_pct || 0),
        cantidad: 1, descuento: 0,
      }];
    });
  };

  const subtotal = items.reduce((a, i) => a + i.precio * Number(i.cantidad) - Number(i.descuento || 0), 0);
  const impuesto = items.reduce((a, i) => {
    const linea = i.precio * Number(i.cantidad) - Number(i.descuento || 0);
    return a + (linea * Number(i.impuesto_pct || 0)) / 100;
  }, 0);
  const total = Math.max(Math.round((subtotal - Number(descGlobal || 0) + impuesto) * 100) / 100, 0);
  const pagado = pagos.reduce((a, p) => a + Number(p.monto || 0), 0);
  const restante = Math.round((total - pagado) * 100) / 100;
  const efectivo = metodos.find((m) => m.es_efectivo);
  const vuelto = Math.max(Math.round((Number(recibido || 0) - restante) * 100) / 100, 0);

  const setItem = (id, k, v) =>
    setItems((prev) => prev.map((i) => (i.producto_id === id ? { ...i, [k]: v } : i)));

  const agregarPago = (metodoId, monto) => {
    if (!metodoId || Number(monto) <= 0) return;
    setPagos((prev) => [...prev, { metodo_id: metodoId, monto: Number(monto) }]);
  };

  const payloadItems = () =>
    items.map((i) => ({
      producto_id: i.producto_id,
      cantidad: Number(i.cantidad),
      descuento: Number(i.descuento || 0),
    }));

  const cobrarACuenta = async () => {
    if (!turno || !empleado) return;
    if (items.length === 0 || !clienteId) {
      avisar("Elegí un cliente registrado para vender a cuenta", false);
      return;
    }
    setCobrando(true);
    try {
      const ccMetodo = metodos.find((m) => m.nombre.toLowerCase().includes("cuenta corriente"));
      if (!ccMetodo) throw new Error("Método 'Cuenta corriente' inactivo");
      const id = await rpc("registrar_venta", {
        p_turno: turno.id,
        p_cliente: clienteId,
        p_vendedor: empleado.id,
        p_descuento: Number(descGlobal || 0),
        p_items: payloadItems(),
        p_pagos: [{ metodo_id: ccMetodo.id, monto: total }],
      });
      const [v] = await listar("ventas", "numero", (x) => x.eq("id", id).limit(1));
      let cuentas = await listar("cuentas_corrientes", "id", (x) =>
        x.eq("tipo", "cliente").eq("cliente_id", clienteId).limit(1));
      if (!cuentas[0]) {
        cuentas = [await crear("cuentas_corrientes", { tipo: "cliente", cliente_id: clienteId })];
      }
      await rpc("registrar_movimiento_cc", {
        p_cuenta: cuentas[0].id,
        p_tipo: "cargo",
        p_monto: total,
        p_concepto: `Venta ${v.numero} a cuenta`,
        p_ref_tipo: "venta",
        p_ref_id: id,
      });
      setTicket({ numero: v.numero, total, items: [...items], pagos: [{ metodo_id: ccMetodo.id, monto: total }], vuelto: 0 });
      limpiar();
      avisar(`Venta ${v.numero} cargada a cuenta corriente`);
    } catch (err) {
      avisar(err.message, false);
    } finally {
      setCobrando(false);
    }
  };

  const limpiar = () => {
    setItems([]);
    setPagos([]);
    setRecibido("");
    setDescGlobal("");
    setClienteId("");
  };

  const cobrar = async (suspender = false) => {
    if (!turno || !empleado) return;
    if (items.length === 0) {
      avisar("Agregá productos a la venta", false);
      return;
    }
    setCobrando(true);
    try {
      if (suspender) {
        const id = await rpc("crear_borrador", {
          p_turno: turno.id,
          p_cliente: clienteId || null,
          p_vendedor: empleado.id,
          p_descuento: Number(descGlobal || 0),
          p_items: payloadItems(),
        });
        const lista = [...suspendidas, { id, fecha: new Date().toISOString(), total }];
        localStorage.setItem(BORRADORES_KEY, JSON.stringify(lista));
        setSuspendidas(lista);
        limpiar();
        avisar("Venta suspendida");
      } else {
        if (Math.abs(restante) > 0.01) {
          avisar(`Falta registrar $${restante.toLocaleString("es-AR")} en pagos`, false);
          return;
        }
        const id = await rpc("registrar_venta", {
          p_turno: turno.id,
          p_cliente: clienteId || null,
          p_vendedor: empleado.id,
          p_descuento: Number(descGlobal || 0),
          p_items: payloadItems(),
          p_pagos: pagos.map((p) => ({ metodo_id: p.metodo_id, monto: p.monto })),
        });
        const [v] = await listar("ventas", "numero,total", (x) => x.eq("id", id).limit(1));
        setTicket({ numero: v.numero, total: v.total, items: [...items], pagos: [...pagos], vuelto });
        limpiar();
        avisar(`Venta ${v.numero} registrada`);
      }
    } catch (err) {
      avisar(err.message, false);
    } finally {
      setCobrando(false);
    }
  };

  const recuperar = async (id) => {
    try {
      const lineas = await listar("venta_items", "cantidad,descuento,productos(id,nombre,precio_venta,impuesto_pct)", (x) =>
        x.eq("venta_id", id));
      const [v] = await listar("ventas", "cliente_id,descuento", (x) => x.eq("id", id).limit(1));
      setItems(
        lineas.map((l) => ({
          producto_id: l.productos.id,
          nombre: l.productos.nombre,
          precio: Number(l.productos.precio_venta),
          impuesto_pct: Number(l.productos.impuesto_pct || 0),
          cantidad: Number(l.cantidad),
          descuento: Number(l.descuento || 0),
        }))
      );
      setClienteId(v.cliente_id || "");
      setDescGlobal(v.descuento || "");
      setPagos([]);
      const lista = suspendidas.filter((s) => s.id !== id);
      localStorage.setItem(BORRADORES_KEY, JSON.stringify(lista));
      setSuspendidas(lista);
      avisar("Borrador recuperado (confirmalo para registrar la venta)");
    } catch (err) {
      avisar(err.message, false);
    }
  };

  const crearClienteRapido = async (e) => {
    e.preventDefault();
    if (!nuevoCliente?.nombre) return;
    try {
      const c = await crear("clientes", {
        nombre: nuevoCliente.nombre,
        documento: nuevoCliente.documento || null,
      });
      setClientes((prev) => [...prev, c]);
      setClienteId(c.id);
      setNuevoCliente(null);
      avisar("Cliente registrado");
    } catch (err) {
      avisar(err.message, false);
    }
  };

  if (!turno) {
    return (
      <section>
        <h2>Punto de venta</h2>
        <p className="error">No hay turno de caja abierto. Abrí la caja para operar.</p>
      </section>
    );
  }
  if (!empleado) {
    return (
      <section>
        <h2>Punto de venta</h2>
        <p className="error">
          Tu usuario no está vinculado como empleado. Un administrador debe
          registrarte en Usuarios → Empleados.
        </p>
      </section>
    );
  }

  return (
    <section className="pos">
      <div className="pos-col">
        <h2>POS · {turno.cajas?.nombre}</h2>
        {msg && <p className={msg.ok ? "ok" : "error"}>{msg.texto}</p>}

        <input
          ref={buscarRef}
          className="pos-buscar"
          placeholder="Buscar por nombre, SKU o código de barras… (F2)"
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
        />
        {resultados.length > 0 && (
          <div className="pos-resultados">
            {resultados.map((p) => (
              <button key={p.id} onClick={() => { agregar(p); setBusqueda(""); setResultados([]); }}>
                <strong>{p.nombre}</strong>
                <span>${Number(p.precio_venta).toLocaleString("es-AR")}</span>
              </button>
            ))}
          </div>
        )}

        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Precio</th>
                <th className="num">Desc.</th>
                <th className="num">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.producto_id}>
                  <td>{i.nombre}</td>
                  <td className="num">
                    <input
                      type="number" min="0.001" step="0.001" value={i.cantidad}
                      onChange={(e) => setItem(i.producto_id, "cantidad", e.target.value)}
                    />
                  </td>
                  <td className="num">${i.precio.toLocaleString("es-AR")}</td>
                  <td className="num">
                    <input
                      type="number" min="0" step="0.01" value={i.descuento}
                      onChange={(e) => setItem(i.producto_id, "descuento", e.target.value)}
                    />
                  </td>
                  <td className="num">
                    ${(i.precio * Number(i.cantidad) - Number(i.descuento || 0)).toLocaleString("es-AR")}
                  </td>
                  <td>
                    <button onClick={() => setItems((prev) => prev.filter((x) => x.producto_id !== i.producto_id))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pos-totales">
          <p>Subtotal: <strong>${subtotal.toLocaleString("es-AR")}</strong></p>
          <p>
            Descuento global:{" "}
            <input type="number" min="0" step="0.01" value={descGlobal} onChange={(e) => setDescGlobal(e.target.value)} />
          </p>
          <p>Impuestos: <strong>${Math.round(impuesto * 100) / 100}</strong></p>
          <p className="total">Total: <strong>${total.toLocaleString("es-AR")}</strong></p>
        </div>
      </div>

      <div className="pos-col pos-lateral">
        <h3>Cliente</h3>
        <div className="form-linea">
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Consumidor final</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.apellido}
              </option>
            ))}
          </select>
          <button type="button" className="secundario" onClick={() => setNuevoCliente({ nombre: "", documento: "" })}>
            + Nuevo
          </button>
        </div>
        {nuevoCliente && (
          <form className="panel-form" onSubmit={crearClienteRapido}>
            <div className="form-grid">
              <input required placeholder="Nombre *" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
              <input placeholder="Documento" value={nuevoCliente.documento} onChange={(e) => setNuevoCliente({ ...nuevoCliente, documento: e.target.value })} />
            </div>
            <div className="form-acciones">
              <button type="submit">Registrar</button>
              <button type="button" className="secundario" onClick={() => setNuevoCliente(null)}>Cancelar</button>
            </div>
          </form>
        )}

        <h3>Pagos (restan ${restante.toLocaleString("es-AR")})</h3>
        {pagos.map((p, i) => (
          <p key={i}>
            {metodos.find((m) => m.id === p.metodo_id)?.nombre}:{" "}
            <strong>${p.monto.toLocaleString("es-AR")}</strong>{" "}
            <button onClick={() => setPagos((prev) => prev.filter((_, j) => j !== i))}>✕</button>
          </p>
        ))}
        <PagoForm
          metodos={metodos}
          restante={restante}
          onAgregar={agregarPago}
        />
        {efectivo && restante > 0 && (
          <p>
            Recibido:{" "}
            <input
              type="number" min="0" step="0.01" value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              placeholder={restante}
            />{" "}
            Vuelto: <strong>${vuelto.toLocaleString("es-AR")}</strong>
          </p>
        )}

        <div className="form-acciones">
          <button id="pos-cobrar" disabled={cobrando || items.length === 0} onClick={() => cobrar(false)}>
            {cobrando ? "Registrando…" : `Cobrar $${total.toLocaleString("es-AR")} (F9)`}
          </button>
          <button type="button" className="secundario" disabled={cobrando || items.length === 0 || !clienteId} onClick={cobrarACuenta} title="Requiere cliente registrado">
            A cuenta
          </button>
          <button type="button" className="secundario" disabled={items.length === 0} onClick={() => cobrar(true)}>
            Suspender
          </button>
          <button type="button" className="secundario" onClick={limpiar}>Cancelar</button>
        </div>

        {suspendidas.length > 0 && (
          <>
            <h3>Suspendidas</h3>
            {suspendidas.map((s) => (
              <p key={s.id}>
                {new Date(s.fecha).toLocaleString("es-AR")} · ${Number(s.total).toLocaleString("es-AR")}{" "}
                <button onClick={() => recuperar(s.id)}>Recuperar</button>
              </p>
            ))}
          </>
        )}

        {ticket && (
          <div className="ticket">
            <h3>Venta {ticket.numero}</h3>
            {ticket.items.map((i) => (
              <p key={i.producto_id}>
                {i.cantidad} × {i.nombre} — ${(i.precio * Number(i.cantidad)).toLocaleString("es-AR")}
              </p>
            ))}
            <p><strong>Total: ${ticket.total.toLocaleString("es-AR")}</strong></p>
            {ticket.vuelto > 0 && <p>Vuelto: ${ticket.vuelto.toLocaleString("es-AR")}</p>}
            <button onClick={() => window.print()}>Imprimir</button>
            <button className="secundario" onClick={() => setTicket(null)}>Cerrar</button>
          </div>
        )}
      </div>
    </section>
  );
}

function PagoForm({ metodos, restante, onAgregar }) {
  const [metodo, setMetodo] = useState("");
  const [monto, setMonto] = useState("");
  return (
    <form
      className="form-linea"
      onSubmit={(e) => {
        e.preventDefault();
        onAgregar(metodo, monto || restante);
        setMetodo("");
        setMonto("");
      }}
    >
      <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        <option value="">Método…</option>
        {metodos.map((m) => (
          <option key={m.id} value={m.id}>{m.nombre}</option>
        ))}
      </select>
      <input
        type="number" min="0.01" step="0.01"
        placeholder={`Monto (${restante})`}
        value={monto} onChange={(e) => setMonto(e.target.value)}
      />
      <button type="submit">Agregar</button>
    </form>
  );
}
