import { useEffect, useRef, useState } from "react";
import { getAuthConfig, loginWithGoogle, loginWithPassword, registerAccount } from "@/app/api.js";
import PasswordField, { fieldClass, fieldLabelClass } from "@/app/components/PasswordField.jsx";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function registrationProblem({ name, username, password }) {
  if (name.trim().length < 2) return "Escribe tu nombre y apellidos";
  if (!USERNAME_PATTERN.test(username.trim().toLowerCase())) {
    return "El usuario debe tener de 3 a 30 caracteres: letras sin acentos, números, punto, guion o guion bajo";
  }
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (password.toLowerCase().includes(username.trim().toLowerCase())) return "La contraseña no puede contener tu usuario";
  return "";
}

function PasswordAccess({ onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const registering = mode === "register";

  const changeMode = (next) => {
    setMode(next);
    setError("");
    setPassword("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const problem = registering ? registrationProblem({ name, username, password }) : "";
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = registering
        ? await registerAccount({ name: name.trim(), username: username.trim().toLowerCase(), password })
        : await loginWithPassword(username.trim(), password);
      onSignedIn(user);
    } catch (submitError) {
      setError(submitError.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div role="group" aria-label="Tengo cuenta o soy nuevo" className="grid grid-cols-2 gap-1 rounded-lg bg-panel p-1">
        {[["login", "Entrar"], ["register", "Crear cuenta"]].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => changeMode(value)}
            className={`min-h-10 rounded-md text-sm font-semibold ${mode === value ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {registering && (
        <div>
          <label htmlFor="account-name" className={fieldLabelClass}>Nombre y apellidos</label>
          <input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={120}
            required
            disabled={busy}
            className={fieldClass}
          />
        </div>
      )}

      <div>
        <label htmlFor="account-username" className={fieldLabelClass}>Usuario</label>
        <input
          id="account-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          required
          disabled={busy}
          aria-describedby={registering ? "account-username-hint" : undefined}
          className={fieldClass}
        />
        {registering && <p id="account-username-hint" className="mt-1 text-xs text-zinc-400">Por ejemplo, martin.garcia</p>}
      </div>

      <PasswordField
        id="account-password"
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete={registering ? "new-password" : "current-password"}
        hint={registering ? "Al menos 8 caracteres. Mejor una que no uses en otro sitio." : "Si la has olvidado, pídele una nueva a un administrador del club."}
        disabled={busy}
      />

      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}

      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-tnt font-bold text-onbrand disabled:opacity-60">
        {busy ? "Un momento…" : registering ? "Crear cuenta" : "Entrar"}
      </button>
    </form>
  );
}

// Solo en la demo para otros clubs (npm run demo): se entra con un toque como cada tipo de usuario.
// En la app publicada no existe: VITE_DEMO no está puesto y el servidor real no acepta estas cuentas.
const DEMO = import.meta.env.VITE_DEMO === "1";
const DEMO_ACCOUNTS = [
  { credential: "demo-coordinacion", name: "Laura Martín", role: "Coordinación del club", hint: "Ve todo: accesos, equipos y premios" },
  { credential: "demo-entrenador", name: "Javier Ortega", role: "Entrenador", hint: "Pone notas, partidos y jugadas" },
  { credential: "demo-jugadora", name: "Carmen López", role: "Jugadora", hint: "Coins, tienda y su personaje" },
  { credential: "demo-jugador", name: "Daniel Sánchez", role: "Jugador", hint: "Equipo masculino" },
  { credential: "demo-familia", name: "Rosa Jiménez", role: "Familia", hint: "Madre de un niño de la Escuela" },
];

function DemoAccess({ onSignedIn }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const enter = async (credential) => {
    setBusy(credential);
    setError("");
    try {
      onSignedIn(await loginWithGoogle(credential));
    } catch (loginError) {
      setError(loginError.message);
      setBusy(null);
    }
  };
  return (
    <section aria-labelledby="demo-title" className="space-y-2 rounded-2xl border border-tnt/40 bg-tnt/10 p-3">
      <h2 id="demo-title" className="text-center text-xs font-extrabold text-orange-200">Demo · entra como</h2>
      <ul className="space-y-1.5">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.credential}>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => enter(account.credential)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-panel px-3 py-2 text-left ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block font-bold text-white">{account.role}</span>
                <span className="block truncate text-xs text-zinc-400">{account.name} · {account.hint}</span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-orange-300">{busy === account.credential ? "Entrando…" : "Entrar"}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-center text-sm font-semibold text-red-300">{error}</p>}
    </section>
  );
}

export default function LoginPage({ onSignedIn }) {
  const buttonRef = useRef(null);
  // Google sigue en modo de prueba: el botón solo sale en /app?google, para quien ya entra con Google.
  const [googleReady, setGoogleReady] = useState(() => new URLSearchParams(window.location.search).has("google"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!googleReady) return undefined;
    let cancelled = false;

    async function setUp() {
      try {
        const { google_client_id: clientId } = await getAuthConfig();
        if (!clientId) {
          setGoogleReady(false);
          return;
        }
        await loadGoogleScript();
        if (cancelled || !buttonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setBusy(true);
            setError("");
            try {
              onSignedIn(await loginWithGoogle(credential));
            } catch (loginError) {
              setError(loginError.message);
              setBusy(false);
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          locale: "es",
          width: Math.min(buttonRef.current.offsetWidth || 320, 400),
        });
      } catch {
        // Sin Google se puede seguir entrando con usuario y contraseña.
        if (!cancelled) setGoogleReady(false);
      }
    }

    setUp();
    return () => {
      cancelled = true;
    };
  }, [googleReady, onSignedIn]);

  return (
    <div className="flex min-h-screen flex-col bg-void px-6 py-8 font-body text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/rotta-logo.svg" alt="Escudo del club Rotta" className="h-20 w-20 rounded-full object-cover" />
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-extrabold">Rotta</h1>
            <p className="text-base leading-relaxed text-zinc-300">Plantillas, chat y entrenamientos del club.</p>
          </div>
        </div>

        <div className="space-y-4">
          {DEMO && <DemoAccess onSignedIn={onSignedIn} />}
          {!DEMO && googleReady && (
            <>
              <div ref={buttonRef} className="flex min-h-11 w-full justify-center" data-testid="google-button" />
              {busy && <p role="status" className="text-center text-sm text-zinc-300">Entrando…</p>}
              {error && <p role="alert" className="text-center text-sm font-semibold text-red-300">{error}</p>}
              <div className="flex items-center gap-3 text-sm text-zinc-400" aria-hidden="true">
                <span className="h-px flex-1 bg-white/15" />
                o con usuario y contraseña
                <span className="h-px flex-1 bg-white/15" />
              </div>
            </>
          )}

          {!DEMO && <PasswordAccess onSignedIn={onSignedIn} />}

          {!DEMO && <p className="text-center text-sm leading-relaxed text-zinc-400">
            La primera vez, un administrador del club tendrá que aprobar tu acceso.
          </p>}
          {!DEMO && <a href="/" className="flex min-h-11 items-center justify-center text-sm font-semibold text-zinc-200 hover:text-white">
            Volver a la web del club
          </a>}
          <a href="/app/privacidad" className="flex min-h-11 items-center justify-center text-xs font-semibold text-zinc-400 underline hover:text-white">
            Política de privacidad
          </a>
        </div>
      </div>
    </div>
  );
}
