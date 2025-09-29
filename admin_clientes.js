// admin_clientes.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://pccvbzvuolmcaegydsxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjY3ZienZ1b2xtY2FlZ3lkc3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Njc4NDEsImV4cCI6MjA3NDI0Mzg0MX0.mk6D8JCEaAi4fJKqiGDXTe--DE1DxdObqp9eeNaLMH4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Guard de admin
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
const tbody = $("tbody");
const formMsg = $("form-msg");
const cuentasMsg = $("cuentas-msg");

// Form
const frm = $("frm");
const id_cliente = $("id_cliente");
const tipo_documento = $("tipo_documento");
const numero_documento = $("numero_documento");
const nombre_completo = $("nombre_completo");
const numero_telefono = $("numero_telefono");
const id_barrio = $("id_barrio");
const btnNuevo = $("btn-nuevo");
const btnEliminar = $("btn-eliminar");

// Filtros / pager
const q = $("q");
const buscar = $("buscar");
const limpiar = $("limpiar");
const prev = $("prev");
const next = $("next");
const pg = $("pg");

const PAGE = 12;
let page = 1;
let total = 0;

// Helpers
function setFormMsg(t, err=false){ formMsg.textContent = t||""; formMsg.style.color = err ? "#c62828" : "#1b5e20"; }
function setCtasMsg(t, err=false){ cuentasMsg.textContent = t||""; cuentasMsg.style.color = err ? "#c62828" : "#1b5e20"; }
function resetForm(){
  frm.reset(); id_cliente.value = "";
  btnEliminar.disabled = true;
  setFormMsg("");
}
function fillForm(c){
  id_cliente.value = c.id_cliente || "";
  tipo_documento.value = c.tipo_documento || "";
  numero_documento.value = c.numero_documento || "";
  nombre_completo.value = c.nombre_completo || "";
  numero_telefono.value = c.numero_telefono || "";
  id_barrio.value = c.id_barrio || "";
  btnEliminar.disabled = !c.id_cliente;
}

// Cargar tabla
async function cargar(p=1){
  page = Math.max(1, p);
  let query = supabase
    .from("cliente")
    .select("id_cliente, tipo_documento, numero_documento, nombre_completo, numero_telefono", { count:"exact" })
    .order("id_cliente", { ascending: false });

  const term = q.value.trim();
  if (term) {
    if (/^\d+$/.test(term)) {
      query = query.or(`numero_documento.ilike.%${term}%,id_cliente.eq.${term}`);
    } else {
      query = query.ilike("nombre_completo", `%${term}%`);
    }
  }

  const from = (page-1)*PAGE, to = from + PAGE - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#c62828">${error.message}</td></tr>`;
    return;
  }
  total = count || 0;
  pintar(data || []);
  actualizarPager();
}

function pintar(rows){
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Sin resultados</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.id_cliente}</td>
      <td>${r.numero_documento || "—"}</td>
      <td>${r.nombre_completo || "—"}</td>
      <td>${r.numero_telefono || "—"}</td>
      <td><button class="btn" data-cuentas="${r.id_cliente}">Ver cuentas</button></td>
      <td>
        <button class="btn dark" data-editar="${r.id_cliente}">Editar</button>
        <button class="btn danger" data-borrar="${r.id_cliente}">Borrar</button>
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

/** Elimina TODO lo relacionado a un cliente:
 *  registro_transacciones (actor) -> transacciones -> cuentas -> contraseñas -> cliente
 *  Si 'transaccion' no existe, se salta esa parte.
 */
async function eliminarClienteEnCascada(id){
  // (0) Borrar registros donde este cliente fue el actor
  try {
    await supabase.from("registro_transacciones").delete().eq("id_cliente_actor", id);
  } catch(_) { /* si no existe la tabla, ignorar */ }

  // 1) Traer IDs de cuentas del cliente
  const { data: cuentas, error: eCtasSel } = await supabase
    .from("cuenta")
    .select("id_cuenta")
    .eq("id_cliente_titular", id);
  if (eCtasSel) throw new Error("Error obteniendo cuentas: " + eCtasSel.message);

  const ids = (cuentas || []).map(c => c.id_cuenta);

  // 2) Intentar borrar transacciones (si la tabla existe)
  if (ids.length > 0) {
    try {
      const lista = ids.join(",");
      const { error: eTx } = await supabase
        .from("transaccion")
        .delete()
        .or(`id_cuenta_origen.in.(${lista}),id_cuenta_destino.in.(${lista})`);
      if (eTx) {
        const msg = (eTx.message || "").toLowerCase();
        if (!msg.includes("relation") || !msg.includes("does not exist")) {
          throw new Error("Error eliminando transacciones: " + eTx.message);
        }
      }
    } catch (err) {
      const m = String(err.message || err).toLowerCase();
      if (!(m.includes("relation") && m.includes("does not exist"))) {
        throw err;
      }
    }

    // 3) Borrar cuentas del cliente
    const { error: eCtasDel } = await supabase
      .from("cuenta")
      .delete()
      .eq("id_cliente_titular", id);
    if (eCtasDel) throw new Error("Error eliminando cuentas: " + eCtasDel.message);
  }

  // 4) Borrar contraseñas del cliente
  const { error: ePwd } = await supabase
    .from("contrasena")
    .delete()
    .eq("id_cliente", id);
  if (ePwd) throw new Error("Error eliminando contraseñas: " + ePwd.message);

  // 5) Borrar cliente
  const { error: eCli } = await supabase
    .from("cliente")
    .delete()
    .eq("id_cliente", id);
  if (eCli) throw new Error("Error eliminando cliente: " + eCli.message);
}

// Eventos tabla (delegación)
tbody.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.editar) {
    const id = Number(t.dataset.editar);
    const { data, error } = await supabase.from("cliente").select("*").eq("id_cliente", id).maybeSingle();
    if (error) return setFormMsg(error.message, true);
    if (data) fillForm(data);
    window.scrollTo({ top:0, behavior:"smooth" });
  }
  if (t.dataset.borrar) {
    const id = Number(t.dataset.borrar);
    if (!confirm("¿Eliminar cliente, sus registros, transacciones (si existen), cuentas y contraseñas?")) return;
    try {
      await eliminarClienteEnCascada(id);
      setFormMsg("Cliente eliminado con todo lo asociado.");
      cargar(page);
    } catch (err) {
      setFormMsg(String(err.message || err), true);
    }
  }
  if (t.dataset.cuentas) {
    abrirCuentas(Number(t.dataset.cuentas));
  }
});

// Crear/actualizar
frm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormMsg("");

  const payload = {
    tipo_documento: tipo_documento.value.trim() || null,
    numero_documento: numero_documento.value.trim() || null,
    nombre_completo: nombre_completo.value.trim() || null,
    numero_telefono: numero_telefono.value.trim() || null,
    id_barrio: id_barrio.value ? Number(id_barrio.value) : null
  };

  if (id_cliente.value) {
    const { error } = await supabase.from("cliente").update(payload).eq("id_cliente", Number(id_cliente.value));
    if (error) return setFormMsg(error.message, true);
    setFormMsg("Cliente actualizado");
  } else {
    const { error } = await supabase.from("cliente").insert([payload]);
    if (error) return setFormMsg(error.message, true);
    setFormMsg("Cliente creado");
  }
  resetForm();
  cargar(1);
});

btnNuevo.addEventListener("click", resetForm);

btnEliminar.addEventListener("click", async () => {
  if (!id_cliente.value) return;
  if (!confirm("¿Eliminar cliente, sus registros, transacciones (si existen), cuentas y contraseñas?")) return;
  const id = Number(id_cliente.value);
  try {
    await eliminarClienteEnCascada(id);
    setFormMsg("Cliente eliminado con todo lo asociado.");
    resetForm();
    cargar(1);
  } catch (err) {
    setFormMsg(String(err.message || err), true);
  }
});

// Filtros y pager
buscar.addEventListener("click", () => cargar(1));
limpiar.addEventListener("click", () => { q.value=""; cargar(1); });
prev.addEventListener("click", () => cargar(page-1));
next.addEventListener("click", () => cargar(page+1));

// ====== Cuentas del cliente ======
const panelCtas = document.getElementById("panel-cuentas");
const tbodyCtas = document.getElementById("tbody-cuentas");
const cerrarCtas = document.getElementById("cerrar-cuentas");

async function abrirCuentas(idCliente){
  panelCtas.style.display = "block";
  tbodyCtas.innerHTML = `<tr><td colspan="5" style="text-align:center;">Cargando…</td></tr>`;
  setCtasMsg("");

  const { data, error } = await supabase
    .from("cuenta")
    .select("id_cuenta, estado_cuenta, saldo_actual, fecha_apertura_cuenta")
    .eq("id_cliente_titular", idCliente)
    .order("id_cuenta", { ascending: true });

  if (error) {
    tbodyCtas.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#c62828">${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbodyCtas.innerHTML = `<tr><td colspan="5" style="text-align:center;">Este cliente no tiene cuentas</td></tr>`;
    return;
  }

  const fmtCOP = (n) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n||0));
  const fmtFecha = (iso) => iso ? new Date(iso).toLocaleDateString("es-CO") : "—";

  tbodyCtas.innerHTML = data.map(c => `
    <tr>
      <td>${c.id_cuenta}</td>
      <td>${c.estado_cuenta || "—"}</td>
      <td>${fmtCOP(c.saldo_actual)}</td>
      <td>${fmtFecha(c.fecha_apertura_cuenta)}</td>
      <td>
        <button class="btn dark" data-activar="${c.id_cuenta}">Activar</button>
        <button class="btn danger" data-bloquear="${c.id_cuenta}">Desactivar</button>
      </td>
    </tr>
  `).join("");
}

// acciones sobre cuentas
tbodyCtas.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.activar) {
    const id = Number(t.dataset.activar);
    const { error } = await supabase.from("cuenta").update({ estado_cuenta: "Activa" }).eq("id_cuenta", id);
    if (error) return setCtasMsg(error.message, true);
    setCtasMsg("Cuenta activada");
    t.closest("tr").children[1].textContent = "Activa";
  }
  if (t.dataset.bloquear) {
    const id = Number(t.dataset.bloquear);
    const { error } = await supabase.from("cuenta").update({ estado_cuenta: "Bloqueada" }).eq("id_cuenta", id);
    if (error) return setCtasMsg(error.message, true);
    setCtasMsg("Cuenta desactivada");
    t.closest("tr").children[1].textContent = "Bloqueada";
  }
});

cerrarCtas.addEventListener("click", () => {
  panelCtas.style.display = "none";
  tbodyCtas.innerHTML = "";
  setCtasMsg("");
});

// Primera carga
cargar(1);

