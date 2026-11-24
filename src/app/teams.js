import { clubHeaders } from "@/app/club.js";

// Los equipos son de cada club: el servidor los da en /api/club/structure (backend/teams.py) y
// loadClubStructure() los carga al arrancar la app, antes de pintar nada. Mientras tanto, o si
// falla, valen los de serie (los mismos que DEFAULT_STRUCTURE en backend/teams.py).
const DEFAULT_STRUCTURE = {
  teams: [
    { id: "masculino", name: "Club Masculino", match_phrase: "del Masculino", beach: false, best_of: 5, schedule: [{ days: [1, 3], start: "19:15", end: "20:45" }] },
    { id: "femenino", name: "Club Senior Femenino", match_phrase: "del Femenino", beach: false, best_of: 5, schedule: [{ days: [1, 3], start: "20:45", end: "22:15" }] },
    { id: "escuela-lm", name: "Club Escuela LM", match_phrase: "de la Escuela", beach: false, best_of: 3, schedule: [{ days: [0, 2], start: "17:45", end: "19:15" }] },
    { id: "escuela-mj", name: "Club Escuela MJ", match_phrase: "de la Escuela", beach: false, best_of: 3, schedule: [{ days: [1, 3], start: "17:45", end: "19:15" }] },
    { id: "playa", name: "Club Playa", match_phrase: "de Playa", beach: true, best_of: 5, schedule: [{ days: [1, 3], start: null, end: null }] },
  ],
  shared_matches: [["escuela-lm", "escuela-mj"]],
  groups: [
    { id: "masculino", name: "Club Masculino", teams: ["masculino"], month_title: "Jugador del mes" },
    { id: "femenino", name: "Club Senior Femenino", teams: ["femenino"], month_title: "Jugadora del mes" },
    { id: "escuela", name: "Club Escuela", teams: ["escuela-lm", "escuela-mj"], month_title: "Estrella del mes" },
  ],
};

// Días de la semana como los guarda el servidor: 0 es lunes.
export const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

// "Lunes", "Martes y jueves", "Lunes, miércoles y viernes".
export function daysLabel(days) {
  const names = days.map((day, index) => (index === 0 ? WEEKDAY_NAMES[day] : WEEKDAY_NAMES[day].toLowerCase()));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

// El horario que guarda el entrenador, con la forma de siempre ({ days: "Martes y jueves", time: "19:15–20:45" }).
export const sessionsToSchedules = (sessions) =>
  sessions.map((session) => ({
    days: daysLabel(session.days),
    time: session.start ? `${session.start}–${session.end}` : "Horario por consultar",
  }));

let structure = DEFAULT_STRUCTURE;

// Se leen siempre al pintar, así que cogen los equipos del club una vez cargados (son `let` a propósito).
// El horario de serie de cada equipo, mientras no llega el que ha guardado su entrenador.
export let TEAM_SCHEDULES = {};
// Cómo se nombra cada equipo en el calendario: "Partido del Femenino".
export let MATCH_TEAM_PHRASE = {};

function applyStructure(next) {
  structure = next;
  TEAM_SCHEDULES = Object.fromEntries(next.teams.map((team) => [team.id, sessionsToSchedules(team.schedule)]));
  MATCH_TEAM_PHRASE = Object.fromEntries(next.teams.map((team) => [team.id, team.match_phrase || `de ${team.name}`]));
}
applyStructure(DEFAULT_STRUCTURE);

/** Carga los equipos del club. Si no se puede, se queda con los de serie: la app sigue funcionando. */
export async function loadClubStructure() {
  try {
    const response = await fetch("/api/club/structure", { credentials: "include", headers: clubHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data?.teams) && data.teams.length) applyStructure(data);
  } catch {
    // Sin conexión: valen los de serie.
  }
}

export const isTeamId = (id) => structure.teams.some((team) => team.id === id);

// El equipo que se enseña si la persona no tiene uno (o el suyo ya no existe).
export const defaultTeamId = () => structure.teams[0].id;

// Vóley playa: pista de arena y sin pabellón.
export const isBeachTeam = (id) => structure.teams.some((team) => team.id === id && team.beach);

// Equipos que entrenan aparte pero juegan los mismos partidos (como las dos Escuelas).
export const shareMatches = (first, second) =>
  first === second || structure.shared_matches.some((together) => together.includes(first) && together.includes(second));
