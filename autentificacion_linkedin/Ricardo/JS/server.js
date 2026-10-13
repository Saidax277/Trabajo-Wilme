require("dotenv").config();

const express = require("express");
const session = require("express-session");
const crypto = require("node:crypto");
const path = require("node:path");
const { createRemoteJWKSet, jwtVerify } = require("jose");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI ||
    !SESSION_SECRET) {
  throw new Error("Faltan variables necesarias en el archivo .env");
}

const ISSUER = "https://www.linkedin.com";
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const JWKS = createRemoteJWKSet(
  new URL("https://www.linkedin.com/oauth/openid/jwks")
);

app.use(session({
  name: "linkedin.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function generarAleatorio() {
  return crypto.randomBytes(32).toString("base64url");
}

// 1. Iniciar el proceso de autenticación.
app.get("/auth/linkedin", (req, res) => {
  const state = generarAleatorio();
  const verifier = generarAleatorio();

  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  req.session.oauthState = state;
  req.session.codeVerifier = verifier;

  const parametros = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  res.redirect(`${AUTH_URL}?${parametros.toString()}`);
});

// 2. Recibir la respuesta de LinkedIn y validar la autenticación.
app.get("/auth/linkedin/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect("/?login=error");
  }

  if (
    typeof state !== "string" ||
    !req.session.oauthState ||
    state !== req.session.oauthState ||
    typeof code !== "string" ||
    !req.session.codeVerifier
  ) {
    return res.status(400).send("Respuesta OAuth no válida.");
  }

  const verifier = req.session.codeVerifier;

  delete req.session.oauthState;
  delete req.session.codeVerifier;

  try {
    // Intercambiar el código por los tokens en el servidor.
    const parametros = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: verifier
    });

    const respuestaToken = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: parametros
    });

    if (!respuestaToken.ok) {
      throw new Error("Falló el intercambio del código OAuth");
    }

    const tokens = await respuestaToken.json();

    if (!tokens.id_token) {
      throw new Error("LinkedIn no devolvió un ID token");
    }

    // Validar firma, emisor, destinatario y caducidad.
    const { payload } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: ISSUER,
      audience: CLIENT_ID,
      algorithms: ["RS256"]
    });

    if (typeof payload.sub !== "string") {
      throw new Error("El token no contiene un usuario válido");
    }

    // Crear una sesión autenticada en el servidor.
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).send("No se pudo crear la sesión.");
      }

      req.session.user = {
        id: payload.sub,
        name: payload.name || "",
        email:
          payload.email_verified === true
            ? payload.email || ""
            : ""
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).send("No se pudo guardar la sesión.");
        }

        res.redirect("/?login=success");
      });
    });
  } catch (err) {
    console.error("Error de autenticación:", err.message);
    res.redirect("/?login=error");
  }
});

// 3. Devolver solo los datos básicos de la sesión.
app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: "No autenticado"
    });
  }

  res.set("Cache-Control", "no-store");
  res.json({
    name: req.session.user.name,
    email: req.session.user.email
  });
});

// 4. Cerrar la sesión.
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie("linkedin.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    if (err) {
      return res.status(500).json({
        error: "No se pudo cerrar la sesión"
      });
    }

    res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});