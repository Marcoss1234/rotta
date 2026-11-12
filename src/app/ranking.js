const toIso = (day) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

const fromIso = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export function currentMonday() {
  const today = new Date();
  today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return toIso(today);
}

export function shiftWeek(monday, weeks) {
  const day = fromIso(monday);
  day.setDate(day.getDate() + weeks * 7);
  return toIso(day);
}

const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

// "del 2 nov al 8 nov"
export function weekLabel(monday) {
  const end = fromIso(monday);
  end.setDate(end.getDate() + 6);
  return `del ${dayMonth.format(fromIso(monday))} al ${dayMonth.format(end)}`;
}

export const formatScore = (score) => String(score).replace(".", ",");
export const formatOverall = (overall) => (overall === null || overall === undefined ? "–" : String(Math.round(overall)));

// Solo para enseñar el resultado mientras se escribe: el que cuenta lo calcula el servidor.
export function overallOf(weights, scores) {
  const rated = Object.entries(weights).filter(([skill]) => scores[skill] !== undefined);
  const total = rated.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) return null;
  return (rated.reduce((sum, [skill, weight]) => sum + scores[skill] * weight, 0) / total) * 10;
}

export function weightPercent(weights, skill) {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  return Math.round((weights[skill] / total) * 100);
}
