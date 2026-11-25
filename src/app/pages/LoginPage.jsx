import { useEffect, useId, useRef, useState } from "react";
import { getAuthConfig, loginWithGoogle, loginWithPassword, registerAccount } from "@/app/api.js";
import { AuthCard, AuthShell } from "@/app/components/auth/AuthShell.jsx";
import { Badge, Button, Field, Input, Notice, PasswordInput, TabPanel, Tabs, cx } from "@/app/ui/index.js";

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

// Las mismas reglas que el servidor (backend/password_auth.py), para avisar en cada campo antes de enviar.
// Se exporta para probarlo aparte.
export function accessProblems({ registering, name, username, password }) {
  const user = username.trim().toLowerCase();
  const problems = {};
  if (registering) {
    if (name.trim().length < 2) problems.name = "Escribe tu nombre y apellidos";
    if (!USERNAME_PATTERN.test(user)) problems.username = "Usa de 3 a 30 letras sin acentos, números o . _ -";
    if (password.length < 8) problems.password = "Al menos 8 caracteres";
    else if (user && password.toLowerCase().includes(user)) problems.password = "La contraseña no puede contener tu usuario";
  } else {
    if (!user) problems.username = "Escribe tu usuario";
    if (!password) problems.password = "Escribe tu contraseña";
  }
  return problems;
}

const FIELD_ORDER = ["name", "username", "password"];
const FIELD_IDS = { name: "account-name", username: "account-username", password: "account-password" };

// Qué pasa después de crear la cuenta: así nadie se sorprende al ver «pendiente».
const STEPS = ["Creas tu cuenta", "Aceptas los permisos de privacidad", "El club te da acceso a tu equipo"];

function NextSteps() {
  return (
    <div className="rounded-card bg-raised p-4">
      <p className="text-sm font-bold text-ink">Así funciona</p>
      <ol className="mt-2.5 space-y-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2.5 text-sm text-ink-muted">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-ink ring-1 ring-line">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AccessForm({ registering, onSignedIn, onSwitch }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refs = { name: useRef(null), username: useRef(null), password: useRef(null) };

  const change = (setter, key) => (event) => {
    setter(event.target.value);
    setProblems((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = accessProblems({ registering, name, username, password });
    setProblems(found);
    setError("");
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    setBusy(true);
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
    <form onSubmit={submit} noValidate className="space-y-4">
      {registering && (
        <Field id={FIELD_IDS.name} label="Nombre y apellidos" error={problems.name}>
          <Input ref={refs.name} id={FIELD_IDS.name} value={name} onChange={change(setName, "name")} autoComplete="name" maxLength={120} required disabled={busy} error={problems.name} />
        </Field>
      )}
      <Field id={FIELD_IDS.username} label="Usuario" hint={registering ? "Por ejemplo, martin.garcia" : undefined} error={problems.username}>
        <Input
          ref={refs.username}
          id={FIELD_IDS.username}
          value={username}
          onChange={change(setUsername, "username")}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          required
          disabled={busy}
          hint={registering ? "Por ejemplo, martin.garcia" : undefined}
          error={problems.username}
        />
      </Field>
      <Field id={FIELD_IDS.password} label="Contraseña" hint={registering ? "Al menos 8 caracteres. Mejor una que no uses en otro sitio." : undefined} error={problems.password}>
        <PasswordInput
          ref={refs.password}
          id={FIELD_IDS.password}
          value={password}
          onChange={change(setPassword, "password")}
          autoComplete={registering ? "new-password" : "current-password"}
          required
          disabled={busy}
          hint={registering ? "Al menos 8 caracteres. Mejor una que no uses en otro sitio." : undefined}
          error={problems.password}
        />
      </Field>

      {!registering && (
        <details className="group text-sm">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden">
            ¿Has olvidado la contraseña?
          </summary>
          <p className="mt-1 rounded-card bg-raised p-3 text-ink-muted">
            Pídele una nueva a un administrador del club. Te dará una contraseña temporal para entrar y, al hacerlo, elegirás una tuya.
          </p>
        </details>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <Button type="submit" size="lg" block busy={busy} busyLabel={registering ? "Creando la cuenta…" : "Entrando…"}>
        {registering ? "Crear cuenta" : "Entrar"}
      </Button>

      {registering ? (
        <NextSteps />
      ) : (
        <p className="text-center text-sm text-ink-muted">
          ¿Es tu primera vez?{" "}
          <button type="button" onClick={onSwitch} className="font-semibold text-ink underline underline-offset-2 hover:text-club-text">
            Crea tu cuenta
          </button>
        </p>
      )}
    </form>
  );
}

function PasswordAccess({ onSignedIn }) {
  const tabsId = useId();
  const [mode, setMode] = useState("login");
  return (
    <div className="space-y-5">
      <Tabs
        id={tabsId}
        label="Tengo cuenta o soy nuevo"
        value={mode}
        onChange={setMode}
        items={[
          { id: "login", label: "Entrar" },
          { id: "register", label: "Crear cuenta" },
        ]}
      />
      {/* Cada pestaña tiene su formulario: al cambiar, no se arrastra la contraseña escrita. */}
      <TabPanel tabsId={tabsId} tab="login" value={mode}>
        <AccessForm onSignedIn={onSignedIn} onSwitch={() => setMode("register")} />
      </TabPanel>
      <TabPanel tabsId={tabsId} tab="register" value={mode}>
        <AccessForm registering onSignedIn={onSignedIn} />
      </TabPanel>
    </div>
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
    <section aria-labelledby="demo-title" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="demo-title" className="font-display text-lg font-extrabold text-ink">Entra como</h2>
        <Badge tone="rotta">Demo</Badge>
      </div>
      <ul className="space-y-2">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.credential}>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => enter(account.credential)}
              className={cx(
                "flex min-h-14 w-full items-center justify-between gap-3 rounded-card bg-raised px-4 py-2.5 text-left transition",
                "hover:ring-1 hover:ring-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rotta-text disabled:opacity-60",
              )}
            >
              <span className="min-w-0">
                <span className="block font-bold text-ink">{account.role}</span>
                <span className="block text-xs text-ink-muted">{account.name} · {account.hint}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-club-text">{busy === account.credential ? "Entrando…" : "Entrar"}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <Notice tone="error">{error}</Notice>}
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
    <AuthShell brandAs="h1">
      <AuthCard>
        {DEMO ? (
          <DemoAccess onSignedIn={onSignedIn} />
        ) : (
          <div className="space-y-5">
            {googleReady && (
              <div className="space-y-3">
                <div ref={buttonRef} className="flex min-h-11 w-full justify-center" data-testid="google-button" />
                {busy && <p role="status" className="text-center text-sm text-ink-muted">Entrando…</p>}
                {error && <Notice tone="error">{error}</Notice>}
                <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted" aria-hidden="true">
                  <span className="h-px flex-1 bg-line" />
                  o con usuario y contraseña
                  <span className="h-px flex-1 bg-line" />
                </div>
              </div>
            )}
            <PasswordAccess onSignedIn={onSignedIn} />
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
