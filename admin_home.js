// admin_home.js
// Bloquea acceso si no es admin
const sesRaw = localStorage.getItem("panda_session");
if (!sesRaw) window.location.href = "./login.html";

const ses = JSON.parse(sesRaw || "{}");
if (!ses.es_admin) {
  alert("Acceso restringido a administradores.");
  window.location.href = "./home.html";
}

// Opcional: mostrar nombre en consola o donde quieras
console.log("Admin:", ses.nombre);

// Si tienes un link de salir en el header, puedes manejarlo así:
const logoutLink = document.getElementById("logout");
if (logoutLink) {
  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("panda_session");
    window.location.href = "./login.html";
  });
}

// IMPORTANTE: NO bloquear los enlaces del menú admin.
// Si quieres forzar navegación por JS, podrías hacer:
// document.getElementById("link-editar-clientes")?.addEventListener("click", (e) => {
//   e.preventDefault(); window.location.href = "./admin_clientes.html";
// });
// document.getElementById("link-editar-cajeros")?.addEventListener("click", (e) => {
//   e.preventDefault(); window.location.href = "./admin_cajeros.html";
// });
// Pero si tu <a href="..."> ya apunta bien, no necesitas nada aquí.

