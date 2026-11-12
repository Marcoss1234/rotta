import { groups } from "../../data/groups.js";

// En la web pública la Escuela es una sola tarjeta; en la app cada horario es un grupo distinto,
// con su plantilla, su cancha y su asistencia.
const escuela = groups.find((group) => group.id === "escuela").schedules;
const scheduleOf = (id) => groups.find((group) => group.id === id).schedules;

export const TEAM_SCHEDULES = {
  masculino: scheduleOf("masculino"),
  femenino: scheduleOf("femenino"),
  "escuela-lm": escuela.filter(({ days }) => days === "Lunes y miércoles"),
  "escuela-mj": escuela.filter(({ days }) => days === "Martes y jueves"),
  playa: scheduleOf("playa"),
};

// Las dos Escuelas juegan los mismos partidos. Debe coincidir con backend/teams.py.
const SHARED_MATCH_TEAMS = ["escuela-lm", "escuela-mj"];
export const shareMatches = (first, second) =>
  first === second || (SHARED_MATCH_TEAMS.includes(first) && SHARED_MATCH_TEAMS.includes(second));

// Cómo se nombra cada equipo en el calendario: "Partido del Femenino".
export const MATCH_TEAM_PHRASE = {
  masculino: "del Masculino",
  femenino: "del Femenino",
  "escuela-lm": "de la Escuela",
  "escuela-mj": "de la Escuela",
  playa: "de Playa",
};

export const isTeamId = (id) => Object.hasOwn(TEAM_SCHEDULES, id ?? "");

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
