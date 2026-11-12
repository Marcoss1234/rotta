export const ROLES = [
  { value: "jugador", label: "Jugador" },
  { value: "familia", label: "Familia" },
  { value: "entrenador", label: "Entrenador" },
  { value: "admin", label: "Administrador" },
];

export const roleLabel = (role) => ROLES.find((item) => item.value === role)?.label ?? "Sin rol";

// Solo orienta qué botones se muestran: quien decide de verdad es el servidor.
export const isStaff = (user) => user.role === "admin" || user.role === "entrenador";

// Con qué se identifica la cuenta: el correo si entra con Google, el usuario si entra con contraseña.
export const accountLabel = (user) => user.email ?? `@${user.username}`;

export const POSITIONS =["Sin definir", "Líbero", "Colocador", "Receptor", "Central", "Opuesto"];
