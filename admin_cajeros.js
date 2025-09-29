// admin_cajeros.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://pccvbzvuolmcaegydsxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjY3ZienZ1b2xtY2FlZ3lkc3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Njc4NDEsImV4cCI6MjA3NDI0Mzg0MX0.mk6D8JCEaAi4fJKqiGDXTe--DE1DxdObqp9eeNaLMH4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Guard admin
(function guard(){
  const raw = localStorage.getItem("panda_session");
  if (!raw) return (window.location.href = "./login.html");
  const ses = JSON.parse(raw || "{}");
  if (!ses.es_admin) {
    alert("Acceso solo para administradores");
    window.location.href = "./home.html";
  }
})();

// DOM
const $ = (id) => document.getElementById(id);
const frm = $("frm");
const id_canal = $("id_canal");
const id_barrio = $("id_barrio");
const indicador_tipo_canal = $("indicador_tipo_canal");
const direccion_canal = $("direccion_canal");
const estado_canal = $("estado_canal");
const latitud = $("latitud");
const longitud = $("longitud");
const btnNuevo = $("btn-nuevo");
const btnEliminar = $("btn-eliminar");
const formMsg = $("form-msg");

const q = $("q");
const fEstado = $("f-estado");
const buscar = $("buscar");
const limpiar = $("limpiar");

const tbody = $("tbody");
const prev = $("prev");
const next = $("next");
const pg = $("pg");

const PAGE = 12;
let page = 1;
let total = 0;

// Helpers UI
function setFormMsg(t, err=false){ formMsg.textContent = t||""; formMsg.style.color = err ? "#c62828" : "#1b5e20"; }
function resetForm(){
  frm.reset();
  id_canal.value = "";
  estado_canal.value = "Activo";
  indicador_tipo_canal.value = "1";
  btnEliminar.disabled = true;
  setFormMsg("");
}
function fillForm(c){
  id_canal.value = c.id_canal || "";
  id_barrio.value = c.id_barrio || "";
  indicador_tipo_canal.value = (c.indicador_tipo_canal ?? 1).toString();
  direccion_canal.value = c.direccion_canal || "";
  estado_canal.value = c.estado_canal || "Activo";
  latitud.value = (c.latitud ?? "").toString();
  longitud.value = (c.longitud ?? "").toString();
  btnEliminar.disabled = !c.id_canal;
}
const tipoChip = (n) => n === 1 ? "ATM 🏧" : "Corresponsal 🏪";
const estadoChip = (s) => s === "Activo" ? "Activo ✅" : "Inactivo ⛔";
const ubicacionTxt = (lat,lon) => (lat!=null && lon!=null) ? `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}` : "—";

// Cargar barrios (primeros 500)
async function cargarBarrios(){
  const { data, error } = await supabase
    .from("barrio")
    .select("id_barrio, nombre_barrio")
    .order("nombre_barrio", { ascending: true })
    .limit(500);
  if (error) {
    setFormMsg("Error cargando barrios: " + error.message, true);
    return;
  }
  id_barrio.innerHTML = `<option value="">Seleccione…</option>` + 
    (data||[]).map(b => `<option value="${b.id_barrio}">${b.nombre_barrio} (ID ${b.id_barrio})</option>`).join("");
}

// Listado paginado
async function cargar(p=1){
  page = Math.max(1, p);

  let query = supabase
    .from("canal")
    .select("id_canal, id_barrio, indicador_tipo_canal, direccion_canal, latitud, longitud, estado_canal", { count:"exact" })
    .order("id_canal", { ascending: false });

  const term = (q.value||"").trim();
  if (term) {
    if (/^\d+$/.test(term)) {
      query = query.or(`id_canal.eq.${term},id_barrio.eq.${term}`);
    } else {
      query = query.ilike("direccion_canal", `%${term}%`);
    }
  }
  const est = fEstado.value;
  if (est) query = query.eq("estado_canal", est);

  const from = (page-1)*PAGE, to = from + PAGE - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#c62828">${error.message}</td></tr>`;
    return;
  }
  total = count || 0;
  pintar(data || []);
  actualizarPager();
}

function pintar(rows){
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Sin resultados</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.id_canal}</td>
      <td>${tipoChip(Number(r.indicador_tipo_canal))}</td>
      <td>${r.direccion_canal || "—"}</td>
      <td>${ubicacionTxt(r.latitud, r.longitud)}</td>
      <td>${estadoChip(r.estado_canal)}</td>
      <td>${r.id_barrio || "—"}</td>
      <td>
        <button class="btn dark" data-editar="${r.id_canal}">Editar</button>
        <button class="btn" data-activar="${r.id_canal}">Activar</button>
        <button class="btn danger" data-inactivar="${r.id_canal}">Inactivar</button>
        <button class="btn danger" data-borrar="${r.id_canal}">Borrar</button>
      </td>
    </tr>
  `).join("");
}

function actualizarPager(){
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  pg.textContent = `Página ${page} de ${totalPages} · ${total} registros`;
  prev.disabled = page <= 1;
  next.disabled = page >= totalPages;
}

// Eventos tabla
tbody.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.editar) {
    const id = Number(t.dataset.editar);
    const { data, error } = await supabase.from("canal").select("*").eq("id_canal", id).maybeSingle();
    if (error) return setFormMsg(error.message, true);
    if (data) fillForm(data);
    window.scrollTo({ top:0, behavior:"smooth" });
  }
  if (t.dataset.activar) {
    const id = Number(t.dataset.activar);
    const { error } = await supabase.from("canal").update({ estado_canal: "Activo" }).eq("id_canal", id);
    if (error) return setFormMsg(error.message, true);
    setFormMsg("Canal activado");
    cargar(page);
  }
  if (t.dataset.inactivar) {
    const id = Number(t.dataset.inactivar);
    const { error } = await supabase.from("canal").update({ estado_canal: "Inactivo" }).eq("id_canal", id);
    if (error) return setFormMsg(error.message, true);
    setFormMsg("Canal inactivado");
    cargar(page);
  }
  if (t.dataset.borrar) {
    const id = Number(t.dataset.borrar);
    if (!confirm("¿Borrar este canal? Si tiene transacciones asociadas, el borrado fallará.")) return;
    const { error } = await supabase.from("canal").delete().eq("id_canal", id);
    if (error) {
      // FK a transaccion.id_canal impide borrar si hay registros
      setFormMsg("No se pudo borrar. Posible restricción por transacciones. Sugerencia: cambiar a 'Inactivo'.", true);
      return;
    }
    setFormMsg("Canal borrado");
    cargar(page);
  }
});

// Crear/Actualizar
frm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormMsg("");

  const payload = {
    id_barrio: id_barrio.value ? Number(id_barrio.value) : null,
    indicador_tipo_canal: indicador_tipo_canal.value ? Number(indicador_tipo_canal.value) : null,
    direccion_canal: (direccion_canal.value||"").trim() || null,
    estado_canal: (estado_canal.value||"").trim() || null,
    latitud: latitud.value !== "" ? Number(latitud.value) : null,
    longitud: longitud.value !== "" ? Number(longitud.value) : null
  };

  if (id_canal.value) {
    // Update
    const id = Number(id_canal.value);
    const { error } = await supabase.from("canal").update(payload).eq("id_canal", id);
    if (error) return setFormMsg(error.message, true);
    setFormMsg("Canal actualizado");
  } else {
    // Insert
    const { error } = await supabase.from("canal").insert([payload]);
    if (error) return setFormMsg(error.message, true);
    setFormMsg("Canal creado");
  }
  resetForm();
  cargar(1);
});

btnNuevo.addEventListener("click", resetForm);

btnEliminar.addEventListener("click", async () => {
  if (!id_canal.value) return;
  if (!confirm("¿Borrar este canal? Si tiene transacciones asociadas, el borrado fallará.")) return;
  const id = Number(id_canal.value);
  const { error } = await supabase.from("canal").delete().eq("id_canal", id);
  if (error) {
    setFormMsg("No se pudo borrar. Posible restricción por transacciones. Sugerencia: cambiar a 'Inactivo'.", true);
    return;
  }
  setFormMsg("Canal borrado");
  resetForm();
  cargar(1);
});

// Filtros y pager
buscar.addEventListener("click", () => cargar(1));
limpiar.addEventListener("click", () => { q.value=""; fEstado.value=""; cargar(1); });
prev.addEventListener("click", () => cargar(page-1));
next.addEventListener("click", () => cargar(page+1));

// Logout
document.getElementById("logout")?.addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem("panda_session");
  window.location.href = "./login.html";
});

// Init
(async function init(){
  await cargarBarrios();
  cargar(1);
})();
