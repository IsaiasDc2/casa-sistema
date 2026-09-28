import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SesionContext = createContext(null);

export const useSesionContext = () => useContext(SesionContext);

/**
 * Carga sesión + perfil + permisos una sola vez.
 * Si el perfil no está activo, el usuario queda bloqueado
 * (mi_rol() devuelve NULL y mis_permisos() vacío a nivel DB).
 */
export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permisos, setPermisos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) {
      setProfile(null);
      setPermisos([]);
      setCargando(false);
      return;
    }
    (async () => {
      setCargando(true);
      const [{ data: perf }, { data: perms }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,nombre,apellido,telefono,estado,roles(nombre)")
          .eq("id", sesion.user.id)
          .single(),
        supabase.rpc("mis_permisos"),
      ]);
      setProfile(perf || null);
      setPermisos(perms || []);
      setCargando(false);
      if (perf) {
        supabase
          .from("profiles")
          .update({ ultimo_acceso: new Date().toISOString() })
          .eq("id", perf.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion?.user?.id]);

  const tienePermiso = (codigo) => permisos.includes(codigo);
  const bloqueado = Boolean(profile && profile.estado !== "activo");
  const salir = () => supabase.auth.signOut();

  return (
    <SesionContext.Provider
      value={{ sesion, profile, permisos, tienePermiso, cargando, bloqueado, salir }}
    >
      {children}
    </SesionContext.Provider>
  );
}
