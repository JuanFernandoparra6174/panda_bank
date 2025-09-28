// admin_home.js
// Bloquea acceso si no es admin y prepara enlaces (placeholders).
const sesRaw = localStorage.getItem("panda_session");
if (!sesRaw) window.location.href = "./login.html";

const ses = JSON.parse(sesRaw || "{}");
if (!ses.es_admin) {
  alert("Acceso restringido a administradores.");
  window.location.href = "./home.html";
}

// Enlaces placeholder (puedes cambiarlos cuando tengas los módulos)
document.getElementById("link-editar-clientes")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("Editar clientes: módulo en construcción.");
});

document.getElementById("link-editar-cajeros")?.addEventListener("click", (e) => {
  e.preventDefault();
  alert("Editar cajeros: módulo en construcción.");
});

