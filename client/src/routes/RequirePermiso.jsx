import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Guarda de permiso por CÓDIGO (no por rol): los roles viven en DB,
 * así agregar roles no exige tocar código. FASE 2 lo conecta al menú.
 */
export function usePermiso(codigo) {
  const [permitido, setPermitido] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function verificar() {
      const { data } = await supabase.rpc("tiene_permiso", { p_codigo: codigo });
      setPermitido(data === true);
      setCargando(false);
    }
    verificar();
  }, [codigo]);

  return { permitido, cargando };
}

export function RequirePermiso({ codigo, children, fallback = <p>Sin permiso.</p> }) {
  const { permitido, cargando } = usePermiso(codigo);
  if (cargando) return <p style={{ padding: 32 }}>Verificando permiso…</p>;
  return permitido ? children : fallback;
}
