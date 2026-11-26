import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, CircleUser, IdCard, LogOut, Palette, Shirt, Shuffle, Sparkles, Trash2, UserCog, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { deleteAvatar, getCoins, getProfile, logout, saveCharacter, updateProfile, uploadAvatar } from "@/app/api.js";
import { prepareAvatar } from "@/app/avatarImage.js";
import CharacterEditor from "@/app/character/CharacterEditor.jsx";
import { lookFromSeed, normalizeLook, randomLook, sameLook } from "@/app/character/looks.js";
import Avatar from "@/app/components/Avatar.jsx";
import CoinsCard from "@/app/components/CoinsCard.jsx";
import InstallCard from "@/app/components/InstallCard.jsx";
import NotificationsCard from "@/app/components/NotificationsCard.jsx";
import PrivacyCard from "@/app/components/PrivacyCard.jsx";
import ThemeSettingsCard from "@/app/components/ThemeSettingsCard.jsx";
import { forgetPushSubscription } from "@/app/notifications.js";
import PasswordChangeForm from "@/app/components/PasswordChangeForm.jsx";
import PasswordSetupForm from "@/app/components/PasswordSetupForm.jsx";
import { fieldClass, fieldLabelClass } from "@/app/components/PasswordField.jsx";
import { accountLabel, POSITIONS, roleLabel } from "@/app/roles.js";
import { Notice, PageHeader, TabPanel, Tabs } from "@/app/ui/index.js";
import { useMediaQuery } from "@/app/useMediaQuery.js";

const PREFERRED = POSITIONS.filter((position) => position !== "Sin definir");
const MAX_PREFERRED = 3;
const HANDS = [
  { value: "derecha", label: "Diestro" },
  { value: "izquierda", label: "Zurdo" },
  { value: "ambas", label: "Ambas" },
];

const shortTeam = (name) => name?.replace(/^Club /, "");

// El 3D se carga solo al entrar al perfil, y solo si el móvil puede dibujarlo.
const AvatarStage = lazy(() => import("@/app/character/AvatarStage.jsx"));

function canDraw3D() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

// Sin personaje guardado sale el mismo que en la pizarra.
const savedLook = (profile) =>
  normalizeLook(profile.character) ?? lookFromSeed(profile.player?.id ?? profile.user.id, profile.user.team_id === "femenino");

function formFromProfile(profile) {
  return {
    name: profile.user.name,
    number: profile.player?.number?.toString() ?? "",
    phone: profile.player?.phone ?? "",
    preferred: profile.preferred_positions,
    hand: profile.dominant_hand,
    height: profile.height_cm?.toString() ?? "",
  };
}

// Estatura en cm escrita en el formulario, si es válida.
const typedHeight = (text) => {
  const value = Number(text);
  return text !== "" && Number.isInteger(value) && value >= 120 && value <= 230 ? value : null;
};

function changesFrom(form, original) {
  const changes = {};
  if (form.name.trim() !== original.name) changes.name = form.name.trim();
  if (form.number !== original.number) changes.number = form.number === "" ? null : Number(form.number);
  if (form.phone.trim() !== original.phone) changes.phone = form.phone.trim() || null;
  if (form.preferred.join() !== original.preferred.join()) changes.preferred_positions = form.preferred;
  if (form.hand !== original.hand) changes.dominant_hand = form.hand;
  if (form.height !== original.height) changes.height_cm = form.height === "" ? null : Number(form.height);
  return changes;
}

function formProblem(form) {
  if (form.name.trim().length < 2) return "Escribe tu nombre";
  if (form.number !== "" && !(Number.isInteger(Number(form.number)) && Number(form.number) >= 0 && Number(form.number) <= 99)) {
    return "El dorsal tiene que ser un número del 0 al 99";
  }
  return "";
}

function PhotoButton({ user, onPhoto, photoBusy }) {
  const inputRef = useRef(null);
  return (
    <div className="pointer-events-auto relative shrink-0">
      <Avatar name={user.name} picture={user.picture} className="h-14 w-14 text-lg ring-2 ring-white/40" />
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        disabled={photoBusy}
        aria-label={user.picture ? "Cambiar foto de perfil" : "Poner foto de perfil"}
        className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg hover:bg-zinc-200 disabled:opacity-60"
      >
        <Camera aria-hidden="true" className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Elegir foto de perfil"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const [file] = event.target.files;
          event.target.value = "";
          if (file) onPhoto(file);
        }}
      />
    </div>
  );
}

function Hero({ profile, look, heightCm, crown, editing, focus, onEdit, onPhoto, photoBusy, photoError, onRemovePhoto }) {
  const { user, player } = profile;
  const playRef = useRef(null);
  const with3D = useMemo(canDraw3D, []);

  return (
    // Mientras se edita, el personaje se queda arriba y más pequeño para ver cada cambio.
    <section className={`force-dark stage overflow-hidden rounded-card text-white ${editing ? "sticky top-0 z-20 shadow-overlay" : "relative"}`} aria-label="Tu ficha">
      {player?.number !== null && player?.number !== undefined && (
        <span aria-hidden="true" className="pointer-events-none absolute -right-3 top-6 select-none font-display text-[10rem] font-extrabold leading-none text-white/[0.07]">
          {player.number}
        </span>
      )}

      <div className={`relative ${editing ? "h-[14rem] md:h-[19rem]" : "h-[18rem] md:h-[24rem]"}`}>
        {with3D ? (
          <Suspense fallback={<p role="status" className="flex h-full items-center justify-center text-sm text-zinc-400">Cargando tu personaje…</p>}>
            <AvatarStage look={look} name={user.name.split(" ")[0]} number={player?.number} position={player?.position} heightCm={heightCm} crown={crown} playRef={playRef} focus={editing ? focus : null} />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Avatar name={user.name} picture={user.picture} className="h-40 w-40 text-5xl ring-4 ring-white/25" />
          </div>
        )}

        <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 ${editing ? "hidden" : ""}`}>
          <PhotoButton user={user} onPhoto={onPhoto} photoBusy={photoBusy} />
          {with3D && <p className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-zinc-200">Tócalo o gíralo</p>}
        </div>
      </div>

      {/* Debajo del personaje, para no taparle las piernas. */}
      <div className={`relative px-4 pb-4 pt-3 ${editing ? "hidden" : ""}`}>
          <h2 className="break-words font-title text-3xl leading-none">{user.name}</h2>
          <p className="mt-1.5 text-sm font-semibold text-white/85">
            {roleLabel(user.role)}{user.also_plays && user.role !== "jugador" ? " · también juega" : ""}
            {profile.team_name ? ` · ${shortTeam(profile.team_name)}` : ""}
          </p>
          {profile.coached_team_names.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <span>Entrena:</span>
              {profile.coached_team_names.map((name) => (
                <span key={name} className="rounded-full bg-white/10 px-2.5 py-1">{shortTeam(name)}</span>
              ))}
            </div>
          )}
          {with3D && !editing && (
            <div className="pointer-events-auto mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => playRef.current?.()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-white/25 bg-black/30 text-sm font-bold backdrop-blur hover:bg-white/10">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Celebrar
              </button>
              <button type="button" onClick={onEdit} className="ui-btn-primary flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-club text-sm font-bold text-on-club">
                <Shirt aria-hidden="true" className="h-4 w-4" />
                Editar personaje
              </button>
            </div>
          )}
      </div>

      {(photoBusy || photoError || user.has_custom_picture) && (
        <div className="relative flex min-h-11 items-center gap-3 px-4 pb-3 text-sm">
          {photoBusy && <p role="status">Subiendo foto…</p>}
          {photoError && <p role="alert" className="rounded bg-black/40 px-2 py-1 font-semibold">{photoError}</p>}
          {user.has_custom_picture && !photoBusy && (
            <button type="button" onClick={onRemovePhoto} className="flex min-h-11 items-center gap-1.5 font-semibold text-zinc-300 underline-offset-4 hover:underline">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Quitar foto
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function CharacterCard({ draft, saved, busy, error, onChange, onTabChange, onCancel, onSave, owned }) {
  const changed = !sameLook(draft, saved);
  return (
    <section aria-labelledby="character-title" className="ui-card space-y-4 rounded-card bg-card p-card ring-2 ring-club-ui/40">
      <div className="flex items-center justify-between gap-3">
        <h2 id="character-title" className="font-display text-2xl font-bold">Tu personaje</h2>
        <button type="button" onClick={() => onChange(randomLook(draft))} className="flex min-h-11 items-center gap-1.5 rounded-full border border-white/20 px-3 text-sm font-semibold hover:bg-white/5">
          <Shuffle aria-hidden="true" className="h-4 w-4" />
          Al azar
        </button>
      </div>
      <p className="text-sm text-zinc-400">Es el mismo que sale en la pizarra cuando el entrenador prepara una jugada.</p>
      <CharacterEditor look={draft} onChange={onChange} onTabChange={onTabChange} owned={owned} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="sticky bottom-0 z-30 grid grid-cols-2 gap-2 bg-card pt-2">
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-12 rounded-control bg-raised font-semibold text-ink ring-1 ring-inset ring-control hover:bg-overlay disabled:opacity-50">
          Cancelar
        </button>
        <button type="button" disabled={busy || !changed} onClick={onSave} className="ui-btn-primary min-h-12 rounded-control bg-club font-bold text-on-club disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  );
}

function Stats({ profile }) {
  const { player, stats } = profile;
  const tiles = [
    { label: "Dorsal", value: player.number ?? "—" },
    { label: "Posición", value: player.position, small: true },
    { label: `Voy · ${stats.days} días`, value: stats.going, icon: CheckCircle2 },
    { label: `No voy · ${stats.days} días`, value: stats.not_going, icon: XCircle },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map(({ label, value, small, icon: Icon }) => (
        <div key={label} className="ui-card rounded-card bg-card p-3">
          <dt className="flex items-center gap-1 text-xs text-ink-muted">
            {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
            {label}
          </dt>
          <dd className={`mt-1 truncate font-display font-extrabold ${small ? "text-lg leading-8" : "text-2xl"}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Card({ title, hint, children }) {
  return (
    <section className="ui-card space-y-3 rounded-card bg-card p-card">
      <div>
        <h2 className="font-title text-lg text-ink">{title}</h2>
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function PreferredPositions({ value, onChange }) {
  const toggle = (position) => {
    if (value.includes(position)) onChange(value.filter((item) => item !== position));
    else if (value.length < MAX_PREFERRED) onChange([...value, position]);
  };

  return (
    <fieldset>
      <legend className={fieldLabelClass}>Posiciones preferidas</legend>
      <p className="mb-2 text-xs text-zinc-400">Hasta {MAX_PREFERRED}, en orden. Toca la primera que prefieras.</p>
      <div className="flex flex-wrap gap-2">
        {PREFERRED.map((position) => {
          const order = value.indexOf(position);
          const selected = order >= 0;
          return (
            <button
              key={position}
              type="button"
              aria-pressed={selected}
              disabled={!selected && value.length >= MAX_PREFERRED}
              onClick={() => toggle(position)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-40 ${
                selected ? "border-tnt bg-tnt text-onbrand" : "border-white/20 text-zinc-200 hover:bg-white/5"
              }`}
            >
              {selected && (
                <span aria-label={`Preferencia ${order + 1}`} className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-tnt">
                  {order + 1}
                </span>
              )}
              {position}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function HandPicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className={fieldLabelClass}>Mano dominante</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-void p-1">
        {HANDS.map((hand) => (
          <button
            key={hand.value}
            type="button"
            aria-pressed={value === hand.value}
            onClick={() => onChange(value === hand.value ? null : hand.value)}
            className={`min-h-10 rounded-md text-sm font-semibold ${value === hand.value ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"}`}
          >
            {hand.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ProfilePage({ user, onSignedOut, onUserChanged, onAccessLost }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [draft, setDraft] = useState(null);
  const [editorTab, setEditorTab] = useState("cuerpo");
  const [characterBusy, setCharacterBusy] = useState(false);
  const [characterError, setCharacterError] = useState("");
  const [coins, setCoins] = useState(null);
  // Secciones en pestañas (Premium deportivo, pantalla fija): en el ordenador la ficha va siempre a la izquierda.
  const wide = useMediaQuery("(min-width: 1024px)");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabsId = "perfil";

  const handleError = useCallback((requestError, show) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      return;
    }
    show(requestError.message);
  }, [onAccessLost]);

  const applyProfile = useCallback((next) => {
    setProfile(next);
    setForm(formFromProfile(next));
    onUserChanged(next.user);
  }, [onUserChanged]);

  useEffect(() => {
    getProfile().then(applyProfile).catch((requestError) => handleError(requestError, setError));
    // Los coins no son imprescindibles: si fallan, el perfil se ve igual.
    getCoins().then(setCoins).catch(() => {});
  }, [applyProfile, handleError]);

  const set = (field) => (value) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const original = profile && formFromProfile(profile);
  const changes = form && original ? changesFrom(form, original) : {};
  const dirty = Object.keys(changes).length > 0;

  const save = async (event) => {
    event.preventDefault();
    const problem = formProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      applyProfile(await updateProfile(changes));
      setSaved(true);
    } catch (requestError) {
      handleError(requestError, setError);
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async (action) => {
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const updated = await action();
      setProfile((current) => ({ ...current, user: updated }));
      onUserChanged(updated);
    } catch (photoFailure) {
      handleError(photoFailure, setPhotoError);
    } finally {
      setPhotoBusy(false);
    }
  };

  const storeCharacter = async () => {
    setCharacterBusy(true);
    setCharacterError("");
    try {
      applyProfile(await saveCharacter(draft));
      setDraft(null);
    } catch (requestError) {
      handleError(requestError, setCharacterError);
    } finally {
      setCharacterBusy(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setError("");
    try {
      await forgetPushSubscription().catch(() => {});
      await logout();
      onSignedOut();
    } catch (logoutError) {
      setError(logoutError.message);
      setSigningOut(false);
    }
  };

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-extrabold">Perfil</h1>
        {error ? <Notice tone="error" inline>{error}</Notice> : <p role="status" className="text-zinc-300">Cargando…</p>}
      </div>
    );
  }

  const { player } = profile;
  const inputDisabled = saving;
  const look = savedLook(profile);

  const tabs = [
    ...(wide ? [] : [{ id: "ficha", label: "Ficha", icon: IdCard }]),
    { id: "datos", label: "Datos", icon: UserCog },
    { id: "apariencia", label: "Apariencia", icon: Palette },
    { id: "cuenta", label: "Cuenta", icon: CircleUser },
  ];
  const requestedTab = searchParams.get("seccion");
  const tab = tabs.some((item) => item.id === requestedTab) ? requestedTab : tabs[0].id;
  const chooseTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("seccion", id);
    setSearchParams(next, { replace: true });
  };

  const ficha = (
    <div className="space-y-3">
      <Hero
        profile={profile}
        look={draft ?? look}
        heightCm={typedHeight(form.height) ?? profile.height_cm}
        crown={coins?.crown ?? null}
        editing={Boolean(draft)}
        focus={editorTab}
        onEdit={() => {
          setCharacterError("");
          setEditorTab("cuerpo");
          setDraft(look);
        }}
        photoBusy={photoBusy}
        photoError={photoError}
        onPhoto={(file) => changePhoto(async () => uploadAvatar(await prepareAvatar(file)))}
        onRemovePhoto={() => changePhoto(deleteAvatar)}
      />

      {draft && (
        <CharacterCard
          owned={profile.owned_items ?? []}
          draft={draft}
          saved={look}
          busy={characterBusy}
          error={characterError}
          onChange={setDraft}
          onTabChange={setEditorTab}
          onCancel={() => setDraft(null)}
          onSave={storeCharacter}
        />
      )}

      {!draft && <CoinsCard coins={coins} />}

      {player && <Stats profile={profile} />}

    </div>
  );

  // Pantalla fija en el móvil (Premium deportivo): arriba el título y las pestañas (Ficha, Datos, Apariencia,
  // Cuenta); cada una se desliza por dentro. En escritorio: tu ficha fija a la izquierda y las pestañas a la derecha.
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 md:h-auto">
      <PageHeader title="Perfil" subtitle={wide ? profile.user.name : undefined} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {wide && <div className="lg:sticky lg:top-8">{ficha}</div>}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Tabs id={tabsId} label="Secciones del perfil" value={tab} onChange={chooseTab} items={tabs} className="shrink-0 [&>button]:px-1.5 [&>button]:text-xs min-[400px]:[&>button]:text-sm" />
        <div className="-mx-gutter min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-2 md:mx-0 md:overflow-visible md:px-0" data-testid="profile-scroll">
          {!wide && <TabPanel tabsId={tabsId} tab="ficha" value={tab}>{ficha}</TabPanel>}
          <TabPanel tabsId={tabsId} tab="datos" value={tab}>
      <form onSubmit={save} className="space-y-4">
        <Card title="Sobre ti">
          <div>
            <label htmlFor="profile-name" className={fieldLabelClass}>Nombre</label>
            <input id="profile-name" value={form.name} onChange={(event) => set("name")(event.target.value)} autoComplete="name" maxLength={120} disabled={inputDisabled} className={fieldClass} />
            <p className="mt-1 text-xs text-zinc-400">Es el nombre que ve todo el club. Los mensajes ya enviados conservan el anterior.</p>
          </div>
          {player && (
            <div>
              <label htmlFor="profile-phone" className={fieldLabelClass}>Teléfono</label>
              <input id="profile-phone" type="tel" value={form.phone} onChange={(event) => set("phone")(event.target.value)} autoComplete="tel" maxLength={30} disabled={inputDisabled} className={fieldClass} />
              <p className="mt-1 text-xs text-zinc-400">Opcional. Solo lo ven entrenadores y administradores.</p>
            </div>
          )}
        </Card>

        <Card title="En la pista" hint={player ? `La posición en el equipo (${player.position}) la decide el entrenador.` : undefined}>
          {player ? (
            <div>
              <label htmlFor="profile-number" className={fieldLabelClass}>Dorsal</label>
              <input
                id="profile-number"
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={form.number}
                onChange={(event) => set("number")(event.target.value)}
                disabled={inputDisabled}
                className={`${fieldClass} max-w-28 font-display text-xl font-bold`}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-400">El dorsal aparecerá cuando estés en una plantilla.</p>
          )}
          <div>
            <label htmlFor="profile-height" className={fieldLabelClass}>Estatura (cm)</label>
            <input
              id="profile-height"
              type="number"
              inputMode="numeric"
              min={120}
              max={230}
              placeholder="175"
              value={form.height}
              onChange={(event) => set("height")(event.target.value)}
              disabled={inputDisabled}
              className={`${fieldClass} max-w-28 font-display text-xl font-bold`}
            />
            <p className="mt-1 text-xs text-zinc-400">Tu personaje sale con esta altura, a escala con la red y los demás en la pizarra.</p>
          </div>
          <PreferredPositions value={form.preferred} onChange={set("preferred")} />
          <HandPicker value={form.hand} onChange={set("hand")} />
        </Card>

        {error && <Notice tone="error">{error}</Notice>}
        {saved && !dirty && <Notice tone="success" inline>Cambios guardados.</Notice>}

        {(dirty || saving) && (
          <div className="sticky bottom-0 z-30 md:bottom-4">
            <button type="submit" disabled={saving} className="min-h-12 w-full rounded-full bg-tnt font-bold text-onbrand shadow-xl shadow-black/50 disabled:opacity-60">
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        )}
      </form>

          </TabPanel>
          <TabPanel tabsId={tabsId} tab="apariencia" value={tab}>
            <ThemeSettingsCard isAdmin={user.role === "admin"} />
          </TabPanel>
          <TabPanel tabsId={tabsId} tab="cuenta" value={tab} className="space-y-4">

      <NotificationsCard />

      <InstallCard />

      <PrivacyCard user={user} onUserChanged={onUserChanged} onSignedOut={onSignedOut} />

      <Card title="Cuenta">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-400">{user.email ? "Correo" : "Usuario"}</dt>
            <dd className="min-w-0 break-words text-right font-semibold">{accountLabel(user)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-400">Acceso con</dt>
            <dd className="font-semibold">{user.has_password ? "Usuario y contraseña" : "Google"}</dd>
          </div>
        </dl>
        {user.has_password && (
          <details className="group border-t border-white/10 pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-zinc-200">Cambiar contraseña</summary>
            <div className="pt-2">
              <PasswordChangeForm
                onChanged={(updated) => {
                  setPasswordChanged(true);
                  onUserChanged(updated);
                }}
              />
            </div>
          </details>
        )}
        {!user.has_password && (
          <details className="group border-t border-white/10 pt-2" open>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-zinc-200">Entrar sin Google</summary>
            <div className="space-y-3 pt-2">
              <p className="text-sm leading-relaxed text-zinc-300">
                Crea un usuario y una contraseña para entrar desde la app como todos. Sigues siendo la misma cuenta, con tus permisos.
              </p>
              <PasswordSetupForm
                onDone={(updated) => {
                  setPasswordChanged(true);
                  onUserChanged(updated);
                }}
              />
            </div>
          </details>
        )}
        {passwordChanged && <Notice tone="success" inline>Contraseña guardada. Ya puedes entrar con tu usuario.</Notice>}
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 font-semibold hover:bg-white/5 disabled:opacity-60"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Cerrar sesión
        </button>
      </Card>
          </TabPanel>
        </div>
      </div>
      </div>
    </div>
  );
}
