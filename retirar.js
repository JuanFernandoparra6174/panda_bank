// retirar.js
// Retiro de efectivo: valida saldo, inserta transacción "Retirar" y descuenta el saldo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Usa tus valores
const SUPABASE_URL = "https://tffkdkilxuruboxexpvr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZmtka2lseHVydWJveGV4cHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1ODMzNjUsImV4cCI6MjA3NDE1OTM2NX0.msdkjFKsdHcFrk8WdOJr8CfDQw4GT-Rhs0oS9CJI1aA";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const selectCajero = $("cajero");
const inputMonto   = $("monto");
const msg          = $("withdraw-msg");
const btnAceptar   = $("btn-aceptar");

// estado local
let cuenta = null; // {id_cuenta, saldo_actual, ...}
let cajeros = [];  // [{id_canal, direccion_canal}]

// helpers
const dineroANum = (s) => Number(String(s).replace(/\D+/g, "")) || 0;
const fmtCOP = (n) => new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(Number(n||0));

function setMsg(text, error=false){
  msg.textContent = text || "";
  msg.style.color = error ? "#c62828" : "#1b5e20";
}

// carga inicial
(async function init(){
  // sesión
  const raw = localStorage.getItem("panda_session");
  if (!raw) return (window.location.href = "./login.html");
  const ses = JSON.parse(raw);

  // cuenta del cliente
  const { data: cta, error: eCta } = await supabase
    .from("cuenta")
    .select("id_cuenta, saldo_actual, estado_cuenta, tope_diario_monto")
    .eq("id_cliente_titular", ses.id_cliente)
    .order("fecha_apertura_cuenta", { ascending:false })
    .limit(1)
    .maybeSingle();

  if (eCta) return setMsg("Error cargando cuenta: " + eCta.message, true);
  if (!cta)  return setMsg("No se encontró una cuenta para este cliente.", true);
  cuenta = cta;

  // cargar cajeros (todos o solo activos si usas 'Activo')
  const { data: listCaj, error: eCaj } = await supabase
    .from("canal")
    .select("id_canal, direccion_canal, estado_canal")
    .order("direccion_canal", { ascending:true });

  if (eCaj) return setMsg("Error cargando cajeros: " + eCaj.message, true);
  cajeros = listCaj || [];

  // poblar select
  for (const c of cajeros){
    const opt = document.createElement("option");
    opt.value = c.id_canal;
    opt.textContent = c.direccion_canal || `Cajero ${c.id_canal}`;
    selectCajero.appendChild(opt);
  }

  setMsg("Saldo disponible: " + fmtCOP(cuenta.saldo_actual));
})();

// chips de montos rápidos
document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    inputMonto.value = dineroANum(btn.dataset.value).toString();
  });
});

// teclado numérico
document.querySelectorAll(".pad .key").forEach(k => {
  k.addEventListener("click", () => {
    const action = k.dataset.action;
    if (action === "clear") {
      inputMonto.value = "";
    } else if (action === "back") {
      inputMonto.value = inputMonto.value.slice(0, -1);
    } else {
      inputMonto.value = (inputMonto.value || "") + k.textContent.trim();
    }
  });
});

// aceptar
btnAceptar.addEventListener("click", async () => {
  setMsg("");
  const id_canal = Number(selectCajero.value) || null;
  const monto = dineroANum(inputMonto.value);

  if (!id_canal) return setMsg("Selecciona un cajero.", true);
  if (!monto || monto <= 0) return setMsg("Ingresa un monto válido.", true);

  // validaciones
  if (monto > Number(cuenta.saldo_actual)) {
    return setMsg("No puedes retirar más de lo que tienes en tu cuenta.", true);
  }

  // (opcional) validación de tope diario si quieres
  // if (monto > Number(cuenta.tope_diario_monto)) return setMsg("Supera tu tope diario.", true);

  // 1) asegurar id_tipo_transaccion = "Retirar"
  const tipoNombre = "Retirar";
  let id_tipo = null;
  {
    const { data: tt, error: e1 } = await supabase
      .from("tipo_transaccion")
      .select("id_tipo_transaccion")
      .eq("nombre_tipo_transaccion", tipoNombre)
      .maybeSingle();

    if (e1) return setMsg("Error buscando tipo de transacción: " + e1.message, true);

    if (tt) {
      id_tipo = tt.id_tipo_transaccion;
    } else {
      const { data: ttNew, error: eNew } = await supabase
        .from("tipo_transaccion")
        .insert([{ nombre_tipo_transaccion: tipoNombre, descripcion_tipo_transaccion: "Retiro de efectivo en cajero" }])
        .select("id_tipo_transaccion")
        .single();
      if (eNew) return setMsg("No se pudo crear tipo transacción: " + eNew.message, true);
      id_tipo = ttNew.id_tipo_transaccion;
    }
  }

  // 2) insertar transacción
  const ahoraISO = new Date().toISOString();
  const caj = Array.from(selectCajero.options).find(o => Number(o.value) === id_canal);
  const detalle = `Retiro en cajero: ${caj?.textContent || id_canal}`;

  const { error: eTx } = await supabase.from("transaccion").insert([{
    id_tipo_transaccion: id_tipo,
    id_cuenta_origen: cuenta.id_cuenta,
    id_cuenta_destino: null,
    id_canal,
    monto_transaccion: monto,
    fecha_hora_transaccion: ahoraISO,
    direccion_ip: null,
    detalle_transaccion: detalle
  }]);

  if (eTx) return setMsg("No se pudo registrar la transacción: " + eTx.message, true);

  // 3) actualizar saldo
  const nuevoSaldo = Number(cuenta.saldo_actual) - monto;
  const { error: eUpd } = await supabase
    .from("cuenta")
    .update({ saldo_actual: nuevoSaldo })
    .eq("id_cuenta", cuenta.id_cuenta);

  if (eUpd) return setMsg("Transacción registrada, pero falló actualizar el saldo: " + eUpd.message, true);

  setMsg(`✅ Retiro exitoso. Nuevo saldo: ${fmtCOP(nuevoSaldo)}`);
  // opcional redirección
  setTimeout(() => window.location.href = "./saldo.html", 900);
});

