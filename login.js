// login.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Usa tus valores reales
const SUPABASE_URL = "https://pccvbzvuolmcaegydsxf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjY3ZienZ1b2xtY2FlZ3lkc3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Njc4NDEsImV4cCI6MjA3NDI0Mzg0MX0.mk6D8JCEaAi4fJKqiGDXTe--DE1DxdObqp9eeNaLMH4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const form = $("form-login");
const msg  = $("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const usuario = $("usuario").value.trim();       // cédula
  const contrasena = $("contrasena").value.trim();

  if (!usuario || !contrasena) return setMsg("Completa usuario y contraseña.", true);

  // 1) Buscar cliente por documento
  const { data: cliente, error: e1 } = await supabase
    .from("cliente")
    .select("id_cliente, numero_documento, nombre_completo")
    .eq("numero_documento", usuario)
    .maybeSingle();

  if (e1) return setMsg("Error verificando usuario: " + e1.message, true);
  if (!cliente) return setMsg("Usuario no existe.", true);

  // 2) Validar contraseña del cliente
  const { data: pass, error: e2 } = await supabase
    .from("contrasena")
    .select("id_contrasena")
    .eq("id_cliente", cliente.id_cliente)
    .eq("clave_acceso", contrasena)
    .order("id_contrasena", { ascending: false })
    .maybeSingle();

  if (e2) return setMsg("Error validando contraseña: " + e2.message, true);
  if (!pass) return setMsg("Contraseña incorrecta.", true);

  // OK: guardar sesión y redirigir
  localStorage.setItem("panda_session", JSON.stringify({
    id_cliente: cliente.id_cliente,
    nombre: cliente.nombre_completo,
    numero_documento: cliente.numero_documento
  }));

  setMsg("✅ Acceso concedido. Redirigiendo…");
  window.location.href = "./home.html";
});

function setMsg(text, isError=false){
  msg.textContent = text || "";
  msg.style.color = isError ? "#ffeb3b" : "#eaffea";
}

