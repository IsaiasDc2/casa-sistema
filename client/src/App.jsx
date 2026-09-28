import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SesionProvider } from "./app/SesionContext";
import { RequireAuth } from "./routes/RequireAuth";
import { RequirePermiso } from "./routes/RequirePermiso";
import AppShell from "./components/layout/AppShell";
import Login from "./features/auth/Login";
import Registro from "./features/auth/Registro";
import PosPage from "./features/pos/PosPage";
import ProductsPage from "./features/products/ProductsPage";
import UsersPage from "./features/admin/UsersPage";
import "./styles/index.css";

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
          <Route path="pos" element={<PosPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route
            path="admin/usuarios"
            element={
              <RequirePermiso codigo="usuarios.gestionar">
                <UsersPage />
              </RequirePermiso>
            }
          />
          <Route index element={<Navigate to="pos" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
