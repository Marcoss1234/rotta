import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, HeartHandshake, Search } from "lucide-react";
import { createTemporaryPassword, listTeams, listUsers, updateUser } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import BackupCard from "@/app/components/BackupCard.jsx";
import UserDialog from "@/app/components/UserDialog.jsx";
import { ROLES, roleLabel } from "@/app/roles.js";
import { Notice } from "@/app/ui/index.js";

const ALL = "todos";
const NO_TEAM = "sin-equipo";
const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/20 bg-card px-3 text-sm text-white placeholder-zinc-400 focus:border-white focus:outline-none";

const normalize = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");
const byName = (a, b) => a.name.localeCompare(b.name, "es");

function UserRow({ user, isSelf, detail, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(user)}
        aria-label={`Abrir ${user.name}`}
        className="flex min-h-[3.25rem] w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
      >
        <Avatar name={user.name} picture={user.picture} className="h-8 w-8 text-xs" />
        <span className="min-w-0 flex-1 truncate font-semibold">
          {user.name}{isSelf && <span className="font-normal text-ink-muted"> (tú)</span>}
        </span>
        <span className="shrink-0 text-sm text-ink-muted">{detail}</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink" />
      </button>
    </li>
  );
}

function UserList({ users, currentUser, onOpen }) {
  return (
    <ul className="divide-y divide-white/10">
      {users.map((user) => (
        <UserRow key={user.id} user={user} isSelf={user.id === currentUser.id} detail={`${roleLabel(user.role)}${user.also_plays && user.role !== "jugador" && user.role !== "familia" ? " · juega" : ""}${user.match_editor && user.role === "jugador" ? " · editor" : ""}`} onOpen={onOpen} />
      ))}
    </ul>
  );
}

export default function UsersPage({ currentUser, onAccessLost }) {
  const [users, setUsers] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState(ALL);
  const [roleFilter, setRoleFilter] = useState(ALL);

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      onAccessLost();
      return;
    }
    setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listUsers().then(setUsers).catch(handleError);
    listTeams().then(setTeams).catch(handleError);
  }, [handleError]);

  const save = async (changes) => {
    try {
      const updated = await updateUser(selected.id, changes);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(null);
      if (updated.id === currentUser.id) onAccessLost();
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      throw requestError;
    }
  };

  const matchesSearch = useCallback((user) => {
    const text = normalize(query.trim());
    return !text || [user.name, user.email, user.username].some((value) => value && normalize(value).includes(text));
  }, [query]);

  const { pending, members, rejected, memberCount } = useMemo(() => {
    const all = users ?? [];
    const approved = all.filter((user) => user.status === "approved");
    return {
      pending: all.filter((user) => user.status === "pending").sort(byName),
      memberCount: approved.length,
      members: approved
        .filter(matchesSearch)
        .filter((user) => roleFilter === ALL || user.role === roleFilter)
        .filter((user) => teamFilter === ALL || (user.team_id ?? NO_TEAM) === teamFilter)
        .sort(byName),
      rejected: all.filter((user) => user.status === "rejected").filter(matchesSearch).sort(byName),
    };
  }, [users, matchesSearch, roleFilter, teamFilter]);

  const families = useMemo(() => members.filter((user) => user.role === "familia"), [members]);

  const groups = useMemo(() => {
    const people = members.filter((user) => user.role !== "familia");
    const result = teams.map((team) => ({ id: team.id, name: team.name, users: people.filter((user) => user.team_id === team.id) }));
    const known = new Set(teams.map((team) => team.id));
    result.push({ id: NO_TEAM, name: "Sin equipo", users: people.filter((user) => !known.has(user.team_id)) });
    return result.filter((group) => group.users.length > 0);
  }, [teams, members]);

  const teamLabel = (teamId) => teams.find((team) => team.id === teamId)?.name.replace(/^Club /, "") ?? "Sin equipo";

  const filtering = query.trim() !== "" || teamFilter !== ALL || roleFilter !== ALL;
  const clearFilters = () => {
    setQuery("");
    setTeamFilter(ALL);
    setRoleFilter(ALL);
  };

  if (!users) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-extrabold">Usuarios</h1>
        {error ? <Notice tone="error" inline>{error}</Notice> : <p role="status" className="text-white/80">Cargando…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">Usuarios</h1>
        <p className="text-sm text-ink-muted">{memberCount === 1 ? "1 miembro" : `${memberCount} miembros`}</p>
      </header>

      {error && <Notice tone="error">{error}</Notice>}

      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="overflow-hidden rounded-3xl bg-card ring-2 ring-tnt" data-testid="users-pending">
          <h2 id="pending-title" className="px-3 pt-3 text-sm font-bold">Esperando acceso · {pending.length}</h2>
          <ul className="mt-1 divide-y divide-white/10">
            {pending.map((user) => (
              <UserRow key={user.id} user={user} detail="Revisar" onOpen={setSelected} />
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-2">
        <div className="relative">
          <label htmlFor="users-search" className="sr-only">Buscar por nombre, correo o usuario</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink-muted" />
          <input
            id="users-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, correo o usuario"
            autoComplete="off"
            className={`${fieldClass} pl-9`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="users-team-filter" className="sr-only">Filtrar por equipo</label>
            <select id="users-team-filter" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className={fieldClass}>
              <option value={ALL}>Todos los equipos</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              <option value={NO_TEAM}>Sin equipo</option>
            </select>
          </div>
          <div>
            <label htmlFor="users-role-filter" className="sr-only">Filtrar por rol</label>
            <select id="users-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={fieldClass}>
              <option value={ALL}>Todos los roles</option>
              {ROLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className="overflow-hidden rounded-3xl bg-card ring-1 ring-white/10" data-testid="users-group">
          <h2 id={`group-${group.id}`} className="border-b border-white/10 px-4 py-3 font-display text-base font-bold">
            {group.name} · {group.users.length}
          </h2>
          <UserList users={group.users} currentUser={currentUser} onOpen={setSelected} />
        </section>
      ))}

      {families.length > 0 && (
        <section aria-labelledby="group-familias" className="mt-8 overflow-hidden rounded-3xl bg-card ring-1 ring-white/10" data-testid="users-families">
          <h2 id="group-familias" className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-display text-base font-bold">
            <HeartHandshake aria-hidden="true" className="h-4 w-4 text-ink-muted" />
            Familias · {families.length}
          </h2>
          <ul className="divide-y divide-white/10">
            {families.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === currentUser.id} detail={teamLabel(user.team_id)} onOpen={setSelected} />
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 && families.length === 0 && (
        <div className="rounded-3xl bg-card p-4 text-sm text-white/80">
          <p>{filtering ? "No hay nadie con esos filtros." : "Todavía no hay miembros."}</p>
          {filtering && (
            <button type="button" onClick={clearFilters} className="mt-2 min-h-11 font-semibold text-white underline underline-offset-4">
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {rejected.length > 0 && (
        <details className="overflow-hidden rounded-xl bg-card" data-testid="users-rejected">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-bold text-white/60">Sin acceso · {rejected.length}</summary>
          <ul className="divide-y divide-white/10 border-t border-white/10">
            {rejected.map((user) => (
              <UserRow key={user.id} user={user} detail="Revisar" onOpen={setSelected} />
            ))}
          </ul>
        </details>
      )}

      {selected && (
        <UserDialog
          key={selected.id}
          user={selected}
          isSelf={selected.id === currentUser.id}
          teams={teams}
          onSave={save}
          onCreateTemporaryPassword={async () => {
            try {
              const { temporary_password: password } = await createTemporaryPassword(selected.id);
              return password;
            } catch (requestError) {
              if (requestError.status === 401 || requestError.status === 403) onAccessLost();
              throw requestError;
            }
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {currentUser?.role === "admin" && <BackupCard />}
    </div>
  );
}
