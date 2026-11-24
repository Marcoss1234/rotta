const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, "miércoles": 3, jueves: 4, viernes: 5, "sábado": 6 };
const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_MS = 24 * 60 * 60 * 1000;

const parseDays = (days) => days.toLowerCase().split(/\s+y\s+|,\s*/).map((name) => WEEKDAYS[name.trim()]).filter((day) => day !== undefined);

function parseTimes(time) {
  const match = time.match(/^(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
  return { start: startHour * 60 + startMinute, end: endHour * 60 + endMinute, startLabel: time.split(/[–-]/)[0], endLabel: time.split(/[–-]/)[1] };
}

function isoDate(now, offset) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const pad = (value) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

function dayLabel(offset, weekday) {
  if (offset === 0) return "Hoy";
  if (offset === 1) return "Mañana";
  return WEEKDAY_NAMES[weekday];
}

/** Próximo entrenamiento según el horario de un grupo. Sin hora conocida (Club Playa), devuelve solo los días. */
export function nextTraining(schedules, now = new Date()) {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  let best = null;

  for (const { days, time } of schedules) {
    const times = parseTimes(time);
    if (!times) continue;
    for (const weekday of parseDays(days)) {
      let offset = (weekday - today + 7) % 7;
      if (offset === 0 && minutesNow >= times.end) offset = 7;
      const startsAt = offset * DAY_MS + (times.start - minutesNow) * 60 * 1000;
      if (!best || startsAt < best.startsAt) {
        const inProgress = offset === 0 && minutesNow >= times.start;
        best = {
          startsAt,
          known: true,
          inProgress,
          date: isoDate(now, offset),
          title: inProgress ? "En curso" : `${offset === 7 ? WEEKDAY_NAMES[weekday] : dayLabel(offset, weekday)}, ${times.startLabel}`,
          detail: `Hasta las ${times.endLabel}`,
          start: times.startLabel,
          end: times.endLabel,
        };
      }
    }
  }

  if (best) return best;
  const first = schedules[0];
  if (!first) return null;
  const offsets = parseDays(first.days).map((weekday) => (weekday - today + 7) % 7);
  const offset = offsets.length ? Math.min(...offsets) : null;
  return {
    known: false,
    inProgress: false,
    date: offset === null ? null : isoDate(now, offset),
    dayName: offset === null ? null : dayLabel(offset, (today + offset) % 7),
    title: first.days,
    detail: first.time,
  };
}


/**
 * El entreno que viene después de `training` (para contestar a los dos a la vez).
 * Solo si los dos tienen hora y el siguiente cae en los próximos 7 días.
 */
export function trainingAfter(schedules, training, now = new Date()) {
  if (!training?.known || !training.date || !training.end) return null;
  const [year, month, day] = training.date.split("-").map(Number);
  const [endHour, endMinute] = training.end.split(":").map(Number);
  const afterEnd = new Date(year, month - 1, day, endHour, endMinute + 1);
  const next = nextTraining(schedules, afterEnd);
  if (!next?.known || next.date === training.date) return null;
  const [nextYear, nextMonth, nextDay] = next.date.split("-").map(Number);
  const when = new Date(nextYear, nextMonth - 1, nextDay);
  if (when - new Date(now.getFullYear(), now.getMonth(), now.getDate()) > 7 * DAY_MS) return null;
  return {
    ...next,
    label: `${WEEKDAY_NAMES[when.getDay()]} ${nextDay} · ${next.start}`,
    shortDay: WEEKDAY_NAMES[when.getDay()].toLowerCase(),
  };
}
