// transferir.js
// Valida destino y saldo. Inserta en transaccion, actualiza saldos y registra en registro_transacciones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://pccvbzvuolmcaegydsxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjY3ZienZ1b2xtY2FlZ3lkc3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Njc4NDEsImV4cCI6MjA3NDI0Mzg0MX0.mk6D8JCEaAi4fJKqiGDXTe--DE1DxdObqp9eeNaLMH4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const $ = (id) => document.getElementById(id);
const selCajero = $("t-cajero");
const inpDestino = $("t-destino");
const inpMonto   = $("t-monto");
const btnAceptar = $("t-aceptar");
const msg        = $("t-msg");

// Estado
let ses = null;
let cuentaOrigen = null; // { id_cuenta, saldo_actual }
const dineroANum = (s) => Number(String(s).replace(/\D+/g, "")) || 0;
const fmtCOP = (n) => new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(Number(n||0));

function setMsg(text, error=false){
  msg.textContent = text || "";
  msg.style.color = error ? "#c62828" : "#1b5e20";
}

// Init: sesión, cuenta origen, cajeros
(async function init(){
  const raw = localStorage.getItem("panda_session");
  if (!raw) return (window.location.href = "./login.html");
  ses = JSON.parse(raw);

  // cuenta origen (la más reciente)
  const { data: cta, error: eCta } = await supabase
    .from("cuenta")
    .select("id_cuenta, saldo_actual")
    .eq("id_cliente_titular", ses.id_cliente)
    .order("fecha_apertura_cuenta", { ascending:false })
    .limit(1)
    .maybeSingle();

  if (eCta) return setMsg("Error cargando tu cuenta: " + eCta.message, true);
  if (!cta)  return setMsg("No se encontró una cuenta para este cliente.", true);
  cuentaOrigen = cta;

  // cajeros
  const { data: cajeros, error: eCaj } = await supabase
    .from("canal")
    .select("id_canal, direccion_canal")
    .order("direccion_canal", { ascending:true });

  if (eCaj) return setMsg("Error cargando cajeros: " + eCaj.message, true);

  for (const c of (cajeros || [])) {
    const opt = document.createElement("option");
    opt.value = c.id_canal;
    opt.textContent = c.direccion_canal || `Cajero ${c.id_canal}`;
    selCajero.appendChild(opt);
  }

  setMsg("Saldo disponible: " + fmtCOP(cuentaOrigen.saldo_actual));
})();

// Aceptar
btnAceptar.addEventListener("click", async () => {
  setMsg("");

  const id_canal = Number(selCajero.value) || null;
  const destino  = inpDestino.value.trim();
  const monto    = dineroANum(inpMonto.value);

  if (!id_canal) return setMsg("Selecciona un cajero.", true);
  if (!destino)  return setMsg("Ingresa la cuenta destino.", true);
  if (!monto || monto <= 0) return setMsg("Ingresa un monto válido.", true);

  // 1) validar que la cuenta destino exista
  const { data: ctaDest, error: eDest } = await supabase
    .from("cuenta")
    .select("id_cuenta, saldo_actual")
    .eq("id_cuenta", destino)
    .maybeSingle();

  if (eDest) return setMsg("Error validando destino: " + eDest.message, true);
  if (!ctaDest) return setMsg("El número de cuenta no está registrado en el banco.", true);

  // 2) no permitir transferir a sí mismo
  if (String(ctaDest.id_cuenta) === String(cuentaOrigen.id_cuenta)) {
    return setMsg("No puedes transferirte a la misma cuenta.", true);
  }

  // 3) validar saldo suficiente
  if (monto > Number(cuentaOrigen.saldo_actual)) {
    return setMsg("No puedes transferir un monto mayor a tu saldo disponible.", true);
  }

  // 4) asegurar tipo "Transferir"
  let id_tipo = null;
  {
    const { data: tt, error: e1 } = await supabase
      .from("tipo_transaccion")
      .select("id_tipo_transaccion")
      .eq("nombre_tipo_transaccion", "Transferir")
      .maybeSingle();

    if (e1) return setMsg("Error buscando tipo de transacción: " + e1.message, true);

    if (tt) id_tipo = tt.id_tipo_transaccion;
    else {
      const { data: ttNew, error: eNew } = await supabase
        .from("tipo_transaccion")
        .insert([{ nombre_tipo_transaccion: "Transferir", descripcion_tipo_transaccion: "Transferencia entre cuentas" }])
        .select("id_tipo_transaccion").single();
      if (eNew) return setMsg("No se pudo crear tipo transacción: " + eNew.message, true);
      id_tipo = ttNew.id_tipo_transaccion;
    }
  }

  // 5) insertar transacción y obtener su id
  const ahoraISO = new Date().toISOString();
  const detalle  = `Transferencia a ${ctaDest.id_cuenta}`;
  const { data: txIns, error: eTx } = await supabase
    .from("transaccion")
    .insert([{
      id_tipo_transaccion: id_tipo,
      id_cuenta_origen: cuentaOrigen.id_cuenta,
      id_cuenta_destino: ctaDest.id_cuenta,
      id_canal,
      monto_transaccion: monto,
      fecha_hora_transaccion: ahoraISO,
      direccion_ip: null,
      detalle_transaccion: detalle
    }])
    .select("id_transaccion")
    .single();

  if (eTx) return setMsg("No se pudo registrar la transacción: " + eTx.message, true);

  // 6) actualizar saldos (nota: sin transacción SQL; para demo está bien)
  const nuevoOrigen  = Number(cuentaOrigen.saldo_actual) - monto;
  const nuevoDestino = Number(ctaDest.saldo_actual) + monto;

  const { error: eUpd1 } = await supabase
    .from("cuenta")
    .update({ saldo_actual: nuevoOrigen })
    .eq("id_cuenta", cuentaOrigen.id_cuenta);
  if (eUpd1) return setMsg("Transacción registrada, pero falló actualizar tu saldo: " + eUpd1.message, true);

  const { error: eUpd2 } = await supabase
    .from("cuenta")
    .update({ saldo_actual: nuevoDestino })
    .eq("id_cuenta", ctaDest.id_cuenta);
  if (eUpd2) return setMsg("Tu saldo se actualizó, pero falló acreditar al destino: " + eUpd2.message, true);

  // 7) registrar en registro_transacciones
  const { error: eReg } = await supabase
    .from("registro_transacciones")
    .insert([{
      id_transaccion:    txIns.id_transaccion,
      id_cliente_actor:  ses.id_cliente,
      id_cuenta_origen:  cuentaOrigen.id_cuenta,
      id_cuenta_destino: ctaDest.id_cuenta,
      id_canal:          id_canal,
      monto:             monto,
      fecha_hora:        ahoraISO,
      ip:                null,
      detalle:           detalle
    }]);

  if (eReg) {
    // No rompemos la UX si falla el registro, pero lo avisamos:
    console.warn("Registro_transacciones falló:", eReg.message);
  }

  setMsg(`✅ Transferencia exitosa. Nuevo saldo: ${fmtCOP(nuevoOrigen)}`);
  setTimeout(() => window.location.href = "./saldo.html", 900);
});
