import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { listPendingUsers, listTeams, reviewAccess } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import { RankingHero } from "@/app/components/RankingVisuals.jsx";
import { accountLabel } from "@/app/roles.js";

const fieldClass = "min-h-11 w-full rounded-lg border border-white/20 bg-void px-3 text-sm text-white focus:border-white focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-zinc-300";

function RequestCard({ person, teams, onDone, onAccessLost }) {
  const [role, setRole] = useState("jugador");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const decide = async (decision) => {
    setBusy(true);
    setError("");
    try {
      await reviewAccess(person.id, decision);
      onDone(person.id);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <li className="space-y-3 rounded-2xl ring-1 ring-white/10 bg-panel p-3" data-testid="access-request">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} picture={person.picture} className="h-10 w-10 text-sm" />
        <div className="min-w-0">
          <p className="break-words font-semibold">{person.name}</p>
          <p className="break-words text-sm text-zinc-400">{accountLabel(person)}</p>
        </div>
      </div>
      {person.has_password && (
        <p className="rounded-lg border border-amber-300/50 p-2.5 text-xs text-amber-100">
          El nombre lo ha escrito esa persona, sin correo verificado: confirma que es quien dice.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`role-${person.id}`} className={labelClass}>Entra como</label>
          <select id={`role-${person.id}`} value={role} disabled={busy} onChange={(event) => setRole(event.target.value)} className={fieldClass}>
            <option value="jugador">Jugador</option>
            <option value="familia">Familia</option>
          </select>
        </div>
        <div>
          <label htmlFor={`team-${person.id}`} className={labelClass}>Equipo</label>
          <select id={`team-${person.id}`} value={teamId} disabled={busy} onChange={(event) => setTeamId(event.target.value)} className={fieldClass}>
            <option value="" disabled>Elige equipo</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name.replace(/^Club /, "")}</option>)}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => decide({ status: "rejected" })} className="min-h-11 rounded-full border border-white/30 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50">
          Rechazar
        </button>
        <button type="button" disabled={busy || !teamId} onClick={() => decide({ status: "approved", role, team_id: teamId })} className="min-h-11 rounded-full bg-tnt text-sm font-bold text-onbrand disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Guardando…" : "Aceptar"}
        </button>
      </div>
    </li>
  );
}

export default function AccessRequestsPage({ onAccessLost }) {
  const [people, setPeople] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState("");

  const handleError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) onAccessLost();
    else setError(requestError.message);
  }, [onAccessLost]);

  useEffect(() => {
    listPendingUsers().then(setPeople).catch(handleError);
    listTeams().then(setTeams).catch(handleError);
  }, [handleError]);

  return (
    <div className="space-y-6">
      <RankingHero title="Nuevos" subtitle={people ? `${people.length} esperando acceso` : ""} stacked>
        <Link to="/app" className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white pl-2 pr-3 text-sm font-extrabold text-void hover:bg-zinc-200">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Inicio
        </Link>
      </RankingHero>

      {error && <p role="alert" className="rounded-2xl border border-red-300/50 bg-panel p-3 text-sm font-semibold text-red-200">{error}</p>}
      {!error && !people && <p role="status" className="text-zinc-300">Cargando…</p>}
      {people?.length === 0 && <p className="rounded-3xl bg-panel p-4 text-sm text-zinc-400">No hay nadie esperando acceso.</p>}
      {people?.length > 0 && (
        <ul className="space-y-2">
          {people.map((person) => (
            <RequestCard
              key={person.id}
              person={person}
              teams={teams}
              onDone={(id) => setPeople((current) => current.filter((item) => item.id !== id))}
              onAccessLost={onAccessLost}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
