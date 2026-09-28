import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function useSesion() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { sesion, cargando };
}

export function RequireAuth({ children }) {
  const { sesion, cargando } = useSesion();
  const location = useLocation();
  if (cargando) return <p style={{ padding: 32 }}>Cargando sesión…</p>;
  if (!sesion) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
