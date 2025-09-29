// admin_transacciones.js
// Filtro por documento (numero_documento) + fechas, con paginación.

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

const $ = (id) => document.getElementById(id);
const txBody = $("tx-body");
const fMsg = $("f-msg");
const fDoc = $("f-doc");
const fDesde = $("f-fecha-desde");
const fHasta = $("f-fecha-hasta");
const btnBuscar = $("btn-buscar");
const btnLimpiar = $("btn-limpiar");
const prev = $("prev");
const next = $("next");
const pg = $("pg");

const PAGE = 15;
let page = 1;
let total = 0;

const fmtCOP = (n) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n||0));
const fmtFechaHora = (iso) => iso ? new Date(iso).toLocaleString("es-CO") : "—";

function setFMsg(t, err=false){ fMsg.textContent = t || ""; fMsg.style.color = err ? "#c62828" : "#1b5e20"; }

function pintar(rows){
  if (!rows.length) {
    txBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Sin resultados</td></tr>`;
    return;
  }
  txBody.innerHTML = rows.map(r => {
    const actor = r.cliente?.nombre_completo
      ? `${r.cliente.nombre_completo} (${r.cliente.numero_documento||"—"})`
      : (r.id_cliente_actor ? `Cliente ${r.id_cliente_actor}` : "—");

    const rutas = `${r.id_cuenta_origen || "—"} → ${r.id_cuenta_destino || "—"}`;
    return `
      <tr>
        <td>${fmtFechaHora(r.fecha_hora)}</td>
        <td>${actor}</td>
        <td>${rutas}</td>
        <td>${fmtCOP(r.monto)}</td>
        <td>${r.id_canal || "—"}</td>
        <td>${r.detalle || "—"}</td>
      </tr>
    `;
  }).join("");
}

function actualizarPager(){
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  pg.textContent = `Página ${page} de ${totalPages} · ${total} registros`;
  prev.disabled = page <= 1;
  next.disabled = page >= totalPages;
}

async function cargar(p = 1){
  page = Math.max(1, p);
  setFMsg("");

  // 1) Si viene documento, conviértelo en lista de id_cliente
  let idsActor = null;
  const doc = fDoc.value.trim();
  if (doc) {
    const { data: clientes, error: eCli } = await supabase
      .from("cliente")
      .select("id_cliente, numero_documento")
      .eq("numero_documento", doc);

    if (eCli) {
      setFMsg("Error buscando cliente por documento: " + eCli.message, true);
      return;
    }
    if (!clientes || clientes.length === 0) {
      total = 0;
      pintar([]);
      actualizarPager();
      return;
    }
    idsActor = clientes.map(c => c.id_cliente);
  }

  // 2) Base select con relación a cliente (para mostrar nombre y documento)
  // Nota: el alias 'cliente:cliente' funciona si Supabase detecta la FK id_cliente_actor -> cliente.id_cliente
  let query = supabase
    .from("registro_transacciones")
    .select("id_registro, fecha_hora, monto, id_canal, id_cuenta_origen, id_cuenta_destino, detalle, id_cliente_actor, cliente:cliente(nombre_completo,numero_documento)", { count:"exact" })
    .order("fecha_hora", { ascending: false });

  // Filtro por actor (si hay documento)
  if (idsActor && idsActor.length > 0) {
    // Si hay varios IDs (por diferentes tipos de documento), filtramos con IN
    query = query.in("id_cliente_actor", idsActor);
  }

  // Filtro por fechas
  const d = fDesde.value ? new Date(fDesde.value) : null;
  const h = fHasta.value ? new Date(fHasta.value) : null;
  if (d) query = query.gte("fecha_hora", d.toISOString());
  if (h) {
    h.setHours(23,59,59,999);
    query = query.lte("fecha_hora", h.toISOString());
  }

  // 3) Paginación
  const from = (page-1)*PAGE, to = from + PAGE - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) {
    setFMsg(error.message, true);
    txBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c62828">${error.message}</td></tr>`;
    return;
  }

  total = count || 0;
  pintar(data || []);
  actualizarPager();
}

// Eventos
btnBuscar.addEventListener("click", () => cargar(1));
btnLimpiar.addEventListener("click", () => { fDoc.value=""; fDesde.value=""; fHasta.value=""; cargar(1); });
prev.addEventListener("click", () => cargar(page-1));
next.addEventListener("click", () => cargar(page+1));

// Primer load
cargar(1);

// Logout opcional si tienes link en header
document.getElementById("logout")?.addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem("panda_session");
  window.location.href = "./login.html";
});
