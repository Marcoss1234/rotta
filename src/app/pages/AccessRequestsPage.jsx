import { useCallback, useEffect, useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { listPendingUsers, listTeams, reviewAccess } from "@/app/api.js";
import Avatar from "@/app/components/Avatar.jsx";
import { RankingHero } from "@/app/components/RankingVisuals.jsx";
import { accountLabel } from "@/app/roles.js";
import { Button, Card, EmptyState, Field, Notice, Select } from "@/app/ui/index.js";

const UNVERIFIED = "Sin correo verificado";

function RequestCard({ person, teams, onDone, onAccessLost }) {
  const ids = useId();
  const [role, setRole] = useState("jugador");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const decide = async (decision) => {
    setBusy(decision.status);
    setError("");
    try {
      await reviewAccess(person.id, decision);
      onDone(person.id);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) onAccessLost();
      setError(requestError.message);
      setBusy(null);
    }
  };

  return (
    <Card as="li" padding="sm" className="space-y-4 md:p-4" data-testid="access-request">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} picture={person.picture} className="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-base font-bold leading-tight text-ink">{person.name}</p>
          <p className="break-words text-sm text-ink-muted">{accountLabel(person)}</p>
          {person.has_password && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning-text ring-1 ring-inset ring-warning/40">
              <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
              {UNVERIFIED}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-3 min-[380px]:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <Field id={`${ids}-rol`} label="Entra como">
          <Select id={`${ids}-rol`} value={role} disabled={Boolean(busy)} onChange={(event) => setRole(event.target.value)}>
            <option value="jugador">Jugador</option>
            <option value="familia">Familia</option>
          </Select>
        </Field>
        <Field id={`${ids}-equipo`} label="Equipo">
          <Select id={`${ids}-equipo`} value={teamId} disabled={Boolean(busy)} onChange={(event) => setTeamId(event.target.value)} hint={teamId ? undefined : "Elige su equipo para poder aceptar."}>
            <option value="" disabled>Elige equipo</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name.replace(/^Club /, "")}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2 min-[380px]:col-span-2 lg:col-span-1 lg:flex">
          <Button variant="secondary" disabled={Boolean(busy)} busy={busy === "rejected"} busyLabel="Guardando…" onClick={() => decide({ status: "rejected" })}>
            Rechazar
          </Button>
          <Button disabled={Boolean(busy) || !teamId} busy={busy === "approved"} busyLabel="Guardando…" onClick={() => decide({ status: "approved", role, team_id: teamId })}>
            Aceptar
          </Button>
        </div>
      </div>
      {/* La ayuda va debajo de la fila (en el ordenador, dentro del campo descuadraba las etiquetas). */}
      {!teamId && <p id={`${ids}-equipo-ayuda`} className="text-xs text-ink-muted">Elige su equipo para poder aceptar.</p>}
      {error && <Notice tone="error" size="sm">{error}</Notice>}
    </Card>
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

  const unverified = people?.some((person) => person.has_password);
  const subtitle = people ? (people.length === 1 ? "1 persona espera acceso" : `${people.length} personas esperan acceso`) : undefined;

  return (
    <div className="space-y-5">
      <RankingHero title="Solicitudes de acceso" subtitle={subtitle} />

      {error && <Notice tone="error">{error}</Notice>}
      {!error && !people && <p role="status" className="text-sm text-ink-muted">Cargando…</p>}
      {people?.length === 0 && <EmptyState>No hay nadie esperando acceso.</EmptyState>}
      {unverified && (
        <Notice tone="warning" announce={false}>
          Quien entra con usuario y contraseña ha escrito su nombre sin un correo verificado: confirma que es quien dice antes de aceptarlo.
        </Notice>
      )}
      {people?.length > 0 && (
        <ul className="space-y-3">
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
