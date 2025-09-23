// home.js
// Lee la sesión del cliente (localStorage) y pinta el nombre.
// Si no hay sesión, redirige a login.html.
// Los links son decorativos por ahora; dejamos hooks para implementar.

const sessionRaw = localStorage.getItem("panda_session");
if (!sessionRaw) {
  window.location.href = "./login.html";
}

const session = JSON.parse(sessionRaw || "{}");
const nombreSpan = document.getElementById("nombre-cliente");
nombreSpan.textContent = session?.nombre || "Cliente";

// (Opcional) acciones futuras
document.getElementById("link-saldo").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Próximo paso: consultar saldo desde Supabase (tabla 'cuenta').");
});

document.getElementById("link-retirar").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Próximo paso: retirar (registrar transacción 'Retiro').");
});

document.getElementById("link-transferir").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Próximo paso: transferir (entre cuentas).");
});

