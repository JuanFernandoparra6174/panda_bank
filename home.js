// home.js
// Lee la sesión y muestra el nombre. Activa navegación a Consultar saldo.

const sessionRaw = localStorage.getItem("panda_session");
if (!sessionRaw) {
  window.location.href = "./login.html";
}
const session = JSON.parse(sessionRaw || "{}");
const nombreSpan = document.getElementById("nombre-cliente");
if (nombreSpan) nombreSpan.textContent = session?.nombre || "Cliente";

const linkSaldo = document.getElementById("link-saldo");
if (linkSaldo) {
  linkSaldo.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "./saldo.html";
  });
}

// Los otros siguen en construcción
const r = (id, msg) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", (e)=>{e.preventDefault(); alert(msg);});
};
r("link-retirar","Próximo paso: retirar (registrar transacción y descontar saldo).");
r("link-transferir","Próximo paso: transferir entre cuentas.");

