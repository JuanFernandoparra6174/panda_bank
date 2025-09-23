// app.js
// Conecta con Supabase y maneja la cascada + registro de cliente

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TODO: Reemplaza estas 2 constantes con tus valores reales
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

// Carga inicial
document.addEventListener("DOMContentLoaded", async () => {
  await cargarDepartamentos();
});

// Poblar <select> genérico
function fillSelect(selectEl, items, valueKey, labelKey, placeholder="Seleccione…") {
  selectEl.innerHTML = ""; // limpiar
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

// --- Eventos de cascada ---
selectDepartamento.addEventListener("change", async (e) => {
  const idDep = e.target.value;
  selectMunicipio.disabled = true;
  selectComuna.disabled = true;
  selectBarrio.disabled = true;
  fillSelect(selectMunicipio, [], "id_municipio", "nombre_municipio"); // reiniciar

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
    // Si tu municipio no maneja comunas, no podremos filtrar barrios (porque barrio solo tiene id_comuna).
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

// --- Envío de formulario: insert en cliente ---
$("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const tipo_documento = $("tipo_documento").value.trim();
  const numero_documento = $("numero_documento").value.trim();
  const nombre_completo = $("nombre_completo").value.trim();
  const numero_telefono = $("numero_telefono").value.trim();
  const id_barrio = Number($("barrio").value);

  if (!tipo_documento || !numero_documento || !nombre_completo || !numero_telefono || !id_barrio) {
    return setMsg("Completa todos los campos.", true);
  }

  // Insertar cliente
  const { data, error } = await supabase
    .from("cliente")
    .insert([{ tipo_documento, numero_documento, nombre_completo, numero_telefono, id_barrio }])
    .select("id_cliente")
    .single();

  if (error) return setMsg("Error creando usuario: " + error.message, true);

  setMsg("✅ Usuario creado. ID: " + data.id_cliente);
  e.target.reset();

  // Reiniciar selects de cascada
  await cargarDepartamentos();
});

// Mensajes
function setMsg(text, isError=false){
  msg.textContent = text || "";
  msg.style.color = isError ? "#ffeb3b" : "#eaffea";
}

