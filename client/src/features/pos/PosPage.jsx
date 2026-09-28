import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PosPage() {
  const [turno, setTurno] = useState(null);

  useEffect(() => {
    supabase
      .from("turnos_caja")
      .select("id, monto_inicial, fecha_apertura, cajas(nombre)")
      .eq("estado", "abierta")
      .order("fecha_apertura", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTurno(data));
  }, []);

  return (
    <section>
      <h2>Punto de venta</h2>
      {turno ? (
        <p>
          Turno abierto: <strong>{turno.cajas?.nombre}</strong> — inicio{" "}
          {turno.monto_inicial}
        </p>
      ) : (
        <p>No hay turno de caja abierto. FASE 7 implementa la apertura.</p>
      )}
      <p>FASE 8 implementa el POS completo (carrito, pagos, ticket).</p>
    </section>
  );
}
