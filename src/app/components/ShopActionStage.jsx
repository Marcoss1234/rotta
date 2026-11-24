import { useEffect, useMemo } from "react";
import { buildPlay } from "@/app/boardPlanner.js";
import { actionsAt, useBoardPlayback } from "@/app/boardRecording.js";
import { ballStateAt } from "@/app/components/board/Board3D.jsx";
import Viewer3D from "@/app/components/board/Viewer3D.jsx";
import { defaultTeamId } from "@/app/teams.js";

// Escaparate de los efectos de la tienda: tu personaje hace el gesto de verdad en la pista 3D
// (rematar, recibir o colocar) con el efecto puesto, igual que se verá en la pizarra.
const BALL_IDS = new Set(["ball"]);
const PAUSE_MS = 700;

// Cada gesto con su jugada corta y una cámara cerca de quien toca el balón.
// Coordenadas de la pista de 0 a 1 (nuestro campo es la mitad de abajo); cámara en metros.
const SCENES = {
  remate: {
    players: { me: [0.24, 0.65], mate: [0.62, 0.57] },
    steps: [
      { playerId: "mate", action: "colocacion", target: { x: 0.2, y: 0.565 } },
      { playerId: "me", action: "remate", target: { x: 0.64, y: 0.2 } },
    ],
    camera: { position: [-7, 2.3, 2.4], target: [-2.5, 1.8, 1.6] },
  },
  recepcion: {
    players: { me: [0.5, 0.8], mate: [0.62, 0.59], rival: [0.5, 0.03] },
    steps: [
      { playerId: "rival", action: "saque", target: { x: 0.5, y: 0.79 } },
      { playerId: "me", action: "recepcion", target: { x: 0.62, y: 0.57 } },
    ],
    camera: { position: [-4.2, 1.6, 7.2], target: [0, 1, 5.3] },
  },
  colocacion: {
    players: { me: [0.62, 0.6], mate: [0.5, 0.8], rival: [0.5, 0.03] },
    steps: [
      { playerId: "rival", action: "saque", target: { x: 0.5, y: 0.79 } },
      { playerId: "mate", action: "recepcion", target: { x: 0.6, y: 0.565 } },
      { playerId: "me", action: "colocacion", target: { x: 0.18, y: 0.565 } },
    ],
    camera: { position: [5.6, 2.2, 5.6], target: [0.6, 1.8, 1] },
  },
};

export default function ShopActionStage({ item, look, profile }) {
  const [action] = item.id.split(":");
  const scene = SCENES[action] ?? SCENES.remate;
  const name = profile.user.name.split(" ")[0];
  const teamId = profile.user.team_id ?? defaultTeamId();

  const rosterById = useMemo(
    () => ({
      me: {
        id: "me",
        name,
        number: profile.player?.number ?? null,
        position: profile.player?.position ?? "Receptor",
        team_id: teamId,
        height_cm: profile.height_cm ?? null,
        character: look,
        picture: null,
      },
    }),
    [name, profile, teamId, look],
  );

  const play = useMemo(() => {
    const elements = Object.entries(scene.players).map(([id, [x, y]]) => ({
      id,
      type: "token",
      side: id === "rival" ? "rival" : "home",
      player_id: id === "me" ? "me" : null,
      label: id === "me" ? String(profile.player?.number ?? "") : "",
      name: id === "me" ? name : "",
      x,
      y,
    }));
    elements.push({ id: "ball", type: "ball", x: 0.5, y: 0.5 });
    const { recording, ballStart } = buildPlay(scene.steps, elements, "ball");
    return {
      recording,
      elements: elements.map((element) => (element.id === "ball" ? { ...element, x: ballStart.x, y: ballStart.y } : element)),
    };
  }, [scene, name, profile]);

  const playback = useBoardPlayback(play.recording, play.elements, null, 500);
  const { playing, toggle } = playback;
  // En bucle: al acabar, una pausa corta y otra vez.
  useEffect(() => {
    if (playing) return undefined;
    const timer = setTimeout(toggle, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [playing, toggle]);

  const ballState = playback.active ? ballStateAt(play.recording, playback.time, BALL_IDS) : { heights: new Map(), flashes: new Map() };

  return (
    <Viewer3D
      elements={playback.shown}
      rosterById={rosterById}
      heights={ballState.heights}
      flashes={ballState.flashes}
      actions={playback.active ? actionsAt(play.recording, playback.time) : null}
      beach={false}
      teamId={teamId}
      showcase={scene.camera}
    />
  );
}
