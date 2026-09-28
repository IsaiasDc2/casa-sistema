import { supabase } from "./supabase";

/** RPC con errores como excepción (mensajes del servidor llegan al UI). */
export async function rpc(nombre, args = {}) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw new Error(error.message);
  return data;
}

/** SELECT simple con error como excepción. */
export async function listar(tabla, sel = "*", mod = null) {
  let q = supabase.from(tabla).select(sel);
  if (mod) q = mod(q);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function crear(tabla, fila) {
  const { data, error } = await supabase.from(tabla).insert(fila).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function actualizar(tabla, id, fila) {
  const { data, error } = await supabase.from(tabla).update(fila).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}
