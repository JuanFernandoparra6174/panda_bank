// home.js
// Lee la sesión y muestra el nombre. Navega a saldo/retirar/transferir.

const sessionRaw = localStorage.getItem("panda_session");
if (!sessionRaw) {
  window.location.href = "./login.html";
}
const session = JSON.parse(sessionRaw || "{}");
const nombreSpan = document.getElementById("nombre-cliente");
if (nombreSpan) nombreSpan.textContent = session?.nombre || "Cliente";

const go = (id, url, fallbackMsg) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    if (url) window.location.href = url;
    else alert(fallbackMsg || "En construcción");
  });
};

go("link-saldo", "./saldo.html");
go("link-retirar", "./retirar.html");
go("link-transferir", null, "Próximo paso: transferir entre cuentas.");


