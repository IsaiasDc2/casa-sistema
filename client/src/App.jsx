import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SesionProvider } from "./app/SesionContext";
import { RequireAuth } from "./routes/RequireAuth";
import { RequirePermiso } from "./routes/RequirePermiso";
import AppShell from "./components/layout/AppShell";
import Login from "./features/auth/Login";
import Registro from "./features/auth/Registro";
import PosPage from "./features/pos/PosPage";
import ProductsPage from "./features/products/ProductsPage";
import InventoryPage from "./features/inventory/InventoryPage";
import CustomersPage from "./features/customers/CustomersPage";
import SuppliersPage from "./features/suppliers/SuppliersPage";
import PurchasesPage from "./features/purchases/PurchasesPage";
import SalesPage from "./features/sales/SalesPage";
import CajaPage from "./features/cash/CajaPage";
import ExpensesPage from "./features/expenses/ExpensesPage";
import ReturnsPage from "./features/returns/ReturnsPage";
import ClaimsPage from "./features/claims/ClaimsPage";
import ReportsPage from "./features/reports/ReportsPage";
import DashboardPage from "./features/reports/DashboardPage";
import UsersPage from "./features/admin/UsersPage";
import AuditPage from "./features/admin/AuditPage";
import ConfigPage from "./features/admin/ConfigPage";
import "./styles/index.css";

const Protegida = ({ codigo, children }) => (
  <RequirePermiso codigo={codigo}>{children}</RequirePermiso>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <SesionProvider>
                <AppShell />
              </SesionProvider>
            </RequireAuth>
          }
        >
          <Route path="dashboard" element={<Protegida codigo="dashboard.ver"><DashboardPage /></Protegida>} />
          <Route path="pos" element={<Protegida codigo="pos.operar"><PosPage /></Protegida>} />
          <Route path="productos" element={<Protegida codigo="productos.ver"><ProductsPage /></Protegida>} />
          <Route path="inventario" element={<Protegida codigo="inventario.ver"><InventoryPage /></Protegida>} />
          <Route path="compras" element={<Protegida codigo="compras.ver"><PurchasesPage /></Protegida>} />
          <Route path="ventas" element={<Protegida codigo="ventas.ver"><SalesPage /></Protegida>} />
          <Route path="clientes" element={<Protegida codigo="clientes.ver"><CustomersPage /></Protegida>} />
          <Route path="proveedores" element={<Protegida codigo="compras.ver"><SuppliersPage /></Protegida>} />
          <Route path="caja" element={<Protegida codigo="caja.operar"><CajaPage /></Protegida>} />
          <Route path="gastos" element={<Protegida codigo="gastos.gestionar"><ExpensesPage /></Protegida>} />
          <Route path="devoluciones" element={<Protegida codigo="devoluciones.crear"><ReturnsPage /></Protegida>} />
          <Route path="reclamos" element={<Protegida codigo="reclamos.gestionar"><ClaimsPage /></Protegida>} />
          <Route path="reportes" element={<Protegida codigo="reportes.ver"><ReportsPage /></Protegida>} />
          <Route path="admin/usuarios" element={<Protegida codigo="usuarios.gestionar"><UsersPage /></Protegida>} />
          <Route path="admin/auditoria" element={<Protegida codigo="auditoria.ver"><AuditPage /></Protegida>} />
          <Route path="admin/config" element={<Protegida codigo="configuracion.gestionar"><ConfigPage /></Protegida>} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
