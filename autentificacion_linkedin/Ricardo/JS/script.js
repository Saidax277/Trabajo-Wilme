const mensaje = document.getElementById("mensaje");
const perfil = document.getElementById("perfil");
const botonCerrar = document.getElementById("cerrarSesion");

async function comprobarSesion() {
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.get("login") === "error") {
    mensaje.textContent = "Usuario o contraseña no validos";
    mensaje.className = "incorrecto";
    return;
  }

  try {
    const respuesta = await fetch("/api/me", {
      credentials: "same-origin"
    });

    if (!respuesta.ok) {
      mensaje.textContent = "";
      return;
    }

    const usuario = await respuesta.json();

    mensaje.textContent = "Cuenta autorizada";
    mensaje.className = "correcto";

    document.getElementById("nombre").textContent =
      usuario.name || "Usuario de LinkedIn";

    document.getElementById("correo").textContent =
      usuario.email || "";

    perfil.hidden = false;
  } catch {
    mensaje.textContent =
      "No se pudo comprobar la sesión. Inténtalo de nuevo.";
    mensaje.className = "incorrecto";
  }
}

botonCerrar.addEventListener("click", async () => {
  try {
    const respuesta = await fetch("/logout", {
      method: "POST",
      credentials: "same-origin"
    });

    if (respuesta.ok) {
      window.location.href = "/";
    } else {
      mensaje.textContent = "No se pudo cerrar la sesión.";
    }
  } catch {
    mensaje.textContent = "Error de conexión.";
  }
});

comprobarSesion();