// app.js
// Registro: cliente + contraseña + cuenta (id_cuenta = tarjeta 16 dígitos)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tus credenciales (las que ya usabas):
const SUPABASE_URL = "https://tffkdkilxuruboxexpvr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmtka2lseHVydWJveGV4cHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1ODMzNjUsImV4cCI6MjA3NDE1OTM2NX0.msdkjFKsdHcFrk8WdOJr8CfDQw4GT-Rhs0oS9CJI1aA";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helpers UI ---
const $ = (id) => document.getElementById(id);
const selectDepartamento = $("departamento");
const selectMunicipio = $("municipio");
const selectComuna = $("comuna");
const selectBarrio = $("barrio");
const msg = $("msg");

// ===== Generar número de tarjeta único (16 dígitos) =====
async function generarTarjetaUnica(maxIntentos = 5) {
  for (let i = 0; i < maxIntentos; i++) {
    const num = generar16();
    // Verificar que no exista ya
    const { data, error } = await supabase
      .from("cuenta")
      .select("id_cuenta")
      .eq("id_cuenta", num.toString())
      .maybeSingle();

    if (!error && !data) return num.toString(); // libre (como string)
  }
  throw new Error("No fue posible generar un número de tarjeta único. Intenta de nuevo.");
}

function generar16() {
  const prefijo = "5223"; // opcional
  let rest = "";
  for (let i = 0; i < 12; i++) rest += Math.floor(Math.random() * 10);
  // devuelve como BigInt para evitar overflow intermedio
  return BigInt(prefijo + rest); // e.g., 5223xxxxxxxxxxxx
}

// Carga inicial de select
document.addEventListener("DOMContentLoaded", async () => {
  await cargarDepartamentos();
});

// Poblar <select> genérico
function fillSelect(selectEl, items, valueKey, labelKey, placeholder="Seleccione…") {
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  for (const it of items) {
    const op = document.createElement("option");
    op.value = it[valueKey];
    op.textContent = it[labelKey];
    selectEl.appendChild(op);
  }
}

// --- Cargar Departamentos ---
async function cargarDepartamentos() {
  setMsg("");
  const { data, error } = await supabase
    .from("departamento")
    .select("id_departamento, nombre_departamento")
    .order("nombre_departamento", { ascending: true });

  if (error) return setMsg("Error cargando departamentos: " + error.message, true);

  fillSelect(selectDepartamento, data, "id_departamento", "nombre_departamento");
  selectMunicipio.disabled = true;
  selectComuna.disabled = true;
  selectBarrio.disabled = true;
}

// --- Cascada ---
selectDepartamento.addEventListener("change", async (e) => {
  const idDep = e.target.value;
  selectMunicipio.disabled = true;
  selectComuna.disabled = true;
  selectBarrio.disabled = true;
  fillSelect(selectMunicipio, [], "id_municipio", "nombre_municipio");

  if (!idDep) return;

  const { data, error } = await supabase
    .from("municipio")
    .select("id_municipio, nombre_municipio")
    .eq("id_departamento", idDep)
    .order("nombre_municipio", { ascending: true });

  if (error) return setMsg("Error cargando municipios: " + error.message, true);

  fillSelect(selectMunicipio, data, "id_municipio", "nombre_municipio");
  selectMunicipio.disabled = false;
});

selectMunicipio.addEventListener("change", async (e) => {
  const idMpio = e.target.value;
  selectComuna.disabled = true;
  selectBarrio.disabled = true;
  fillSelect(selectComuna, [], "id_comuna", "nombre_comuna");

  if (!idMpio) return;

  const { data, error } = await supabase
    .from("comuna")
    .select("id_comuna, nombre_comuna")
    .eq("id_municipio", idMpio)
    .order("nombre_comuna", { ascending: true });

  if (error) return setMsg("Error cargando comunas: " + error.message, true);

  if (data.length === 0) {
    setMsg("Este municipio no tiene comunas cargadas. Agrega comunas y barrios con id_comuna para usar la cascada.", true);
    fillSelect(selectComuna, [], "id_comuna", "nombre_comuna");
    selectComuna.disabled = true;
    return;
  }

  fillSelect(selectComuna, data, "id_comuna", "nombre_comuna");
  selectComuna.disabled = false;
});

selectComuna.addEventListener("change", async (e) => {
  const idComuna = e.target.value;
  selectBarrio.disabled = true;
  fillSelect(selectBarrio, [], "id_barrio", "nombre_barrio");

  if (!idComuna) return;

  const { data, error } = await supabase
    .from("barrio")
    .select("id_barrio, nombre_barrio")
    .eq("id_comuna", idComuna)
    .order("nombre_barrio", { ascending: true });

  if (error) return setMsg("Error cargando barrios: " + error.message, true);

  fillSelect(selectBarrio, data, "id_barrio", "nombre_barrio");
  selectBarrio.disabled = false;
});

// --- Envío: cliente + contraseña + cuenta ---
$("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const tipo_documento = $("tipo_documento").value.trim();
  const numero_documento = $("numero_documento").value.trim();
  const nombre_completo = $("nombre_completo").value.trim();
  const numero_telefono = $("numero_telefono").value.trim();
  const clave_acceso = $("clave_acceso").value.trim(); // NUEVO
  const id_barrio = Number($("barrio").value);

  if (!tipo_documento || !numero_documento || !nombre_completo || !numero_telefono || !clave_acceso || !id_barrio) {
    return setMsg("Completa todos los campos.", true);
  }

  // 1) Crear cliente
  const { data: cli, error: e1 } = await supabase
    .from("cliente")
    .insert([{ tipo_documento, numero_documento, nombre_completo, numero_telefono, id_barrio }])
    .select("id_cliente")
    .single();

  if (e1) return setMsg("Error creando usuario: " + e1.message, true);

  // 2) Guardar contraseña ligada al cliente
  const ahoraISO = new Date().toISOString();
  const { error: ePass } = await supabase
    .from("contrasena")
    .insert([{
      id_cliente: cli.id_cliente,
      clave_acceso,                   // en producción: guardar HASH
      fecha_inicio_vigencia: ahoraISO,
      fecha_fin_vigencia: null
    }]);

  if (ePass) return setMsg("Usuario creado, pero falló guardar la contraseña: " + ePass.message, true);

  // 3) Generar tarjeta y crear cuenta
  let tarjeta;
  try {
    tarjeta = await generarTarjetaUnica();
  } catch (err) {
    return setMsg("Usuario creado, pero falló la tarjeta: " + err.message, true);
  }

  const nuevaCuenta = {
    id_cuenta: tarjeta,                // id = N° tarjeta (string OK para BIGINT)
    id_cliente_titular: cli.id_cliente,
    estado_cuenta: "Activa",
    saldo_actual: 0,
    tope_diario_monto: 2000000,
    costo_manejo_mensual: 16000,
    fecha_apertura_cuenta: ahoraISO
  };

  const { error: e2 } = await supabase.from("cuenta").insert([nuevaCuenta]);
  if (e2) return setMsg("Usuario y contraseña OK, pero falló la cuenta: " + e2.message, true);

  setMsg(`✅ Usuario, contraseña y cuenta creados. Nº Tarjeta: ${tarjeta}`);
  e.target.reset();
  await cargarDepartamentos(); // reiniciar cascada
});

// Mensajes
function setMsg(text, isError=false){
  msg.textContent = text || "";
  msg.style.color = isError ? "#ffeb3b" : "#eaffea";
}
