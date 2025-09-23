// saldo.js
// Muestra saldo y datos de la cuenta del cliente logueado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TU proyecto (mismos valores que ya usas)
const SUPABASE_URL = "https://pccvbzvuolmcaegydsxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjY3ZienZ1b2xtY2FlZ3lkc3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Njc4NDEsImV4cCI6MjA3NDI0Mzg0MX0.mk6D8JCEaAi4fJKqiGDXTe--DE1DxdObqp9eeNaLMH4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const $ = (id) => document.getElementById(id);
const saldoGrande   = $("saldo-grande");
const numCuenta     = $("num-cuenta");
const estadoCuenta  = $("estado-cuenta");
const fechaApertura = $("fecha-apertura");
const costoManejo   = $("costo-manejo");
const topeDiario    = $("tope-diario");

// Helpers de formato
const fmtCOP = (n) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
}).format(Number(n||0));

const fmtFecha = (d) => {
  if (!d) return "—";
  const f = new Date(d);
  return f.toLocaleDateString("es-CO", { day:"2-digit", month:"long", year:"numeric" });
};

// Cargar datos
(async function init() {
  const raw = localStorage.getItem("panda_session");
  if (!raw) return (window.location.href = "./login.html");
  const ses = JSON.parse(raw);

  // Traer la CUENTA más reciente del cliente (por si un día hay varias)
  const { data: cuenta, error } = await supabase
    .from("cuenta")
    .select("id_cuenta, estado_cuenta, saldo_actual, tope_diario_monto, costo_manejo_mensual, fecha_apertura_cuenta")
    .eq("id_cliente_titular", ses.id_cliente)
    .order("fecha_apertura_cuenta", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    saldoGrande.textContent = "Error cargando saldo";
    console.error(error);
    return;
  }
  if (!cuenta) {
    saldoGrande.textContent = "No se encontró una cuenta para este cliente.";
    return;
  }

  // Pintar datos
  saldoGrande.textContent   = fmtCOP(cuenta.saldo_actual);
  numCuenta.textContent     = String(cuenta.id_cuenta);
  estadoCuenta.textContent  = cuenta.estado_cuenta || "—";
  fechaApertura.textContent = fmtFecha(cuenta.fecha_apertura_cuenta);
  costoManejo.textContent   = fmtCOP(cuenta.costo_manejo_mensual);
  topeDiario.textContent    = fmtCOP(cuenta.tope_diario_monto);
})();

