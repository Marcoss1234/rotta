import { listPlayers, listTeams } from "@/app/api.js";

// En la pizarra se puede usar a cualquier jugador del club, sea del equipo que sea.
export async function loadClubPlayers() {
  const teams = await listTeams();
  const rosters = await Promise.all(teams.map((team) => listPlayers(team.id)));
  return { teams, players: rosters.flat() };
}

// Las jugadas se guardan de 0 a 1 sobre la pista entera; al dibujar se pasan a estas unidades.
export const COURT_WIDTH = 100;
export const COURT_HEIGHT = 190;

export const BOARD_KINDS = [
  { value: "saque", label: "Saque" },
  { value: "recepcion", label: "Recepción" },
  { value: "ataque", label: "Ataque" },
  { value: "defensa", label: "Defensa" },
  { value: "rotacion", label: "Rotación" },
  { value: "otro", label: "Otro" },
];

export const boardKindLabel = (kind) => BOARD_KINDS.find((item) => item.value === kind)?.label ?? "Otro";

export const newElementId = () => Math.random().toString(36).slice(2, 12);

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const roundCoord = (value) => Math.round(clamp(value) * 10000) / 10000;

function bounds(element) {
  if (element.type === "arrow") {
    return { minX: Math.min(element.x1, element.x2), maxX: Math.max(element.x1, element.x2), minY: Math.min(element.y1, element.y2), maxY: Math.max(element.y1, element.y2) };
  }
  if (element.type === "stroke") {
    const xs = element.points.map(([x]) => x);
    const ys = element.points.map(([, y]) => y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  if (element.type === "zone") return { minX: element.x, maxX: element.x + element.w, minY: element.y, maxY: element.y + element.h };
  return { minX: element.x, maxX: element.x, minY: element.y, maxY: element.y };
}

// Mueve un elemento entero sin que se salga ni se deforme contra el borde.
export function translateElement(element, deltaX, deltaY) {
  const { minX, maxX, minY, maxY } = bounds(element);
  const dx = clamp(deltaX, -minX, 1 - maxX);
  const dy = clamp(deltaY, -minY, 1 - maxY);
  const move = (value, delta) => roundCoord(value + delta);
  if (element.type === "arrow") {
    return { ...element, x1: move(element.x1, dx), y1: move(element.y1, dy), x2: move(element.x2, dx), y2: move(element.y2, dy) };
  }
  if (element.type === "stroke") {
    return { ...element, points: element.points.map(([x, y]) => [move(x, dx), move(y, dy)]) };
  }
  return { ...element, x: move(element.x, dx), y: move(element.y, dy) };
}

export function moveHandle(element, handle, point) {
  const x = roundCoord(point.x);
  const y = roundCoord(point.y);
  if (element.type === "arrow") return handle === "start" ? { ...element, x1: x, y1: y } : { ...element, x2: x, y2: y };
  if (element.type === "zone") {
    return { ...element, w: Math.max(0.03, roundCoord(x - element.x)), h: Math.max(0.03, roundCoord(y - element.y)) };
  }
  return element;
}

// La posición de esta jugada manda sobre la de su ficha.
export const tokenPosition = (element, player) => element.position ?? player?.position ?? null;

export const firstName = (name) => name.trim().split(/\s+/)[0].slice(0, 20);
export const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

export function tokenFromPlayer(player, index) {
  return {
    id: newElementId(),
    type: "token",
    side: "home",
    player_id: player.id,
    label: player.number !== null && player.number !== undefined ? String(player.number) : initialsOf(player.name),
    name: firstName(player.name),
    x: roundCoord(0.2 + (index % 3) * 0.3),
    y: roundCoord(0.6 + (Math.floor(index / 3) % 3) * 0.15),
  };
}

export function rivalToken(count) {
  return { id: newElementId(), type: "token", side: "rival", player_id: null, label: `R${count + 1}`, name: "", x: roundCoord(0.2 + (count % 3) * 0.3), y: 0.55 };
}

// Cada balón nuevo sale un poco al lado del anterior para que no queden uno encima de otro.
export const newBall = (count = 0) => ({
  id: newElementId(),
  type: "ball",
  x: roundCoord(0.5 + ((count % 5) - 2) * 0.16),
  y: roundCoord(0.9 - Math.floor(count / 5) * 0.05),
});

export const emptyBoard = (teamId, name = "Jugada nueva") => ({
  team_id: teamId,
  name,
  kind: "otro",
  court: "full",
  published: false,
  steps: [{ elements: [] }],
});

// Los jugadores del equipo que hay en la pista: lo que se guarda como alineación.
export const lineupTokens = (elements) =>
  elements.filter((element) => element.type === "token" && element.side === "home" && element.player_id);

export function nextLineupName(lineups) {
  const used = lineups.map((lineup) => Number(/^Alineación (\d+)$/.exec(lineup.name)?.[1] ?? 0));
  return `Alineación ${Math.max(0, ...used) + 1}`;
}

// Pone una alineación guardada: quien ya está se mueve a su sitio (así no se pierde su grabación),
// quien falta se añade y quien no está en ella se quita. Rivales, balón y dibujos se quedan.
export function applyLineup(elements, lineup) {
  const saved = new Map(lineup.tokens.map((token) => [token.player_id, token]));
  const isPlayer = (element) => element.type === "token" && element.side === "home" && element.player_id;
  const kept = elements
    .filter((element) => !isPlayer(element) || saved.has(element.player_id))
    .map((element) => {
      if (!isPlayer(element)) return element;
      const spot = saved.get(element.player_id);
      return { ...element, x: spot.x, y: spot.y, position: spot.position ?? null };
    });
  const present = new Set(kept.filter(isPlayer).map((element) => element.player_id));
  const added = lineup.tokens
    .filter((token) => !present.has(token.player_id))
    .map((token) => ({ ...token, id: newElementId() }));
  return [...kept, ...added];
}

// Zonas de cada equipo vistas desde nuestro banquillo, con la red en el medio de la pista.
// Nosotros jugamos abajo mirando hacia arriba: delante, de izquierda a derecha, 4 3 2; detrás 5 6 1.
// El rival juega arriba mirando hacia abajo, así que su derecha es nuestra izquierda: delante 2 3 4; detrás 1 6 5.
const COURT_SIDES = {
  home: { inCourt: (element) => element.y > 0.5, nearNetFirst: (a, b) => a.y - b.y, front: [4, 3, 2], back: [5, 6, 1] },
  rival: { inCourt: (element) => element.y < 0.5, nearNetFirst: (a, b) => b.y - a.y, front: [2, 3, 4], back: [1, 6, 5] },
};
// Al rotar, cada uno pasa a la zona siguiente: 2→1, 1→6, 6→5, 5→4, 4→3, 3→2.
const NEXT_ZONE = { 2: 1, 1: 6, 6: 5, 5: 4, 4: 3, 3: 2 };

const courtPlayers = (elements, side) =>
  elements.filter((element) => element.type === "token" && element.side === side && COURT_SIDES[side].inCourt(element));

// La zona de cada jugador de un equipo, solo si tiene seis en su campo: si no, no se sabe quién está dónde.
function sideZones(elements, side) {
  const players = courtPlayers(elements, side);
  if (players.length !== 6) return null;
  const { nearNetFirst, front, back } = COURT_SIDES[side];
  const byDepth = [...players].sort(nearNetFirst);
  const zones = new Map();
  [byDepth.slice(0, 3), byDepth.slice(3)].forEach((row, index) => {
    const names = index === 0 ? front : back;
    [...row].sort((a, b) => a.x - b.x).forEach((player, column) => zones.set(player.id, names[column]));
  });
  return zones;
}

export const canRotate = (elements, side) => sideZones(elements, side) !== null;

// Las zonas de los dos equipos juntas, para pintarlas en las chapas.
export function rotationZones(elements) {
  const zones = new Map([...(sideZones(elements, "home") ?? []), ...(sideZones(elements, "rival") ?? [])]);
  return zones.size > 0 ? zones : null;
}

// Una rotación: cada jugador ocupa el sitio de quien estaba en su zona siguiente.
// Se respeta la forma de la formación (recepción en W, etc.), solo cambia quién está en cada hueco.
export function rotateElements(elements, side = "home") {
  const zones = sideZones(elements, side);
  if (!zones) return null;
  const spotByZone = new Map();
  elements.forEach((element) => {
    if (zones.has(element.id)) spotByZone.set(zones.get(element.id), { x: element.x, y: element.y });
  });
  return elements.map((element) => {
    if (!zones.has(element.id)) return element;
    const spot = spotByZone.get(NEXT_ZONE[zones.get(element.id)]);
    return { ...element, x: spot.x, y: spot.y };
  });
}

// Un paso de la animación entre dos momentos de la pista con los mismos elementos.
export function blendElements(from, to, progress) {
  const target = new Map(to.map((element) => [element.id, element]));
  return from.map((element) => {
    const end = target.get(element.id);
    if (!end || element.x === undefined || end.x === undefined) return end ?? element;
    return { ...end, x: element.x + (end.x - element.x) * progress, y: element.y + (end.y - element.y) * progress };
  });
}
