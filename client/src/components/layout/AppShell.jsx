import { Link, Outlet, useLocation } from "react-router-dom";
import { useSesionContext } from "../../app/SesionContext";
import "./AppShell.css";

const MENU = [
  { to: "dashboard", label: "Dashboard", permiso: "dashboard.ver" },
  { to: "pos", label: "POS", permiso: "pos.operar" },
  { to: "productos", label: "Productos", permiso: "productos.ver" },
  { to: "inventario", label: "Inventario", permiso: "inventario.ver" },
  { to: "compras", label: "Compras", permiso: "compras.ver" },
  { to: "ventas", label: "Ventas", permiso: "ventas.ver" },
  { to: "clientes", label: "Clientes", permiso: "clientes.ver" },
  { to: "proveedores", label: "Proveedores", permiso: "compras.ver" },
  { to: "caja", label: "Caja", permiso: "caja.operar" },
  { to: "gastos", label: "Gastos", permiso: "gastos.gestionar" },
  { to: "devoluciones", label: "Devoluciones", permiso: "devoluciones.crear" },
  { to: "reclamos", label: "Reclamos", permiso: "reclamos.gestionar" },
  { to: "reportes", label: "Reportes", permiso: "reportes.ver" },
  { to: "admin/usuarios", label: "Usuarios", permiso: "usuarios.gestionar" },
  { to: "admin/auditoria", label: "Auditoría", permiso: "auditoria.ver" },
  { to: "admin/config", label: "Configuración", permiso: "configuracion.gestionar" },
];

export default function AppShell() {
  const { profile, tienePermiso, cargando, bloqueado, salir } = useSesionContext();
  const location = useLocation();

  if (cargando) return <p className="app-cargando">Cargando sesión…</p>;

  if (bloqueado) {
    return (
      <main className="app-bloqueado">
        <h1>Cuenta {profile.estado}</h1>
        <p>Tu acceso fue {profile.estado}. Contactá a un administrador.</p>
        <button onClick={salir}>Cerrar sesión</button>
      </main>
    );
  }

  const items = MENU.filter((m) => tienePermiso(m.permiso));

  return (
    <div className="app">
      <aside className="app-side">
        <Link to="pos" className="app-logo">
          Casa Isaias
        </Link>
        <nav>
          {items.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={location.pathname.endsWith(m.to) ? "activo" : ""}
            >
              {m.label}
              {m.fase && <small>{m.fase}</small>}
            </Link>
          ))}
        </nav>
        <div className="app-user">
          <strong>
            {profile?.nombre} {profile?.apellido}
          </strong>
          <small>{profile?.roles?.nombre}</small>
          <button onClick={salir}>Salir</button>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
