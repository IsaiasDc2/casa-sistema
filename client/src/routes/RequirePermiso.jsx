import { useEffect, useState } from "react";
import { useSesionContext } from "../app/SesionContext";
import { supabase } from "../lib/supabase";

/** Verificación puntual por RPC (para uso fuera del SesionProvider). */
export function usePermiso(codigo) {
  const [permitido, setPermitido] = useState(false);
  const [cargando, setCargando] = useState(Boolean(codigo));

  useEffect(() => {
    if (!codigo) {
      setCargando(false);
      return;
    }
    supabase.rpc("tiene_permiso", { p_codigo: codigo }).then(({ data }) => {
      setPermitido(data === true);
      setCargando(false);
    });
  }, [codigo]);

  return { permitido, cargando };
}

/**
 * Guarda de permiso por CÓDIGO (no por rol). Dentro del SesionProvider
 * reutiliza los permisos ya cargados; fuera de él consulta por RPC.
 */
export function RequirePermiso({ codigo, children, fallback = <p>Sin permiso.</p> }) {
  const ctx = useSesionContext();
  const rpc = usePermiso(ctx ? null : codigo);

  if (ctx) return ctx.tienePermiso(codigo) ? children : fallback;
  if (rpc.cargando) return <p style={{ padding: 32 }}>Verificando permiso…</p>;
  return rpc.permitido ? children : fallback;
}
