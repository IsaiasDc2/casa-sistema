import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./routes/RequireAuth";
import Login from "./features/auth/Login";
import PosPage from "./features/pos/PosPage";
import ProductsPage from "./features/products/ProductsPage";
import "./styles/index.css";

function Shell() {
  return (
    <div className="app">
      <header className="app-bar">
        <strong>Casa Isaias</strong>
        <nav>
          <a href="/app/pos">POS</a>
          <a href="/app/productos">Productos</a>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="pos" element={<PosPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route index element={<Navigate to="pos" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
