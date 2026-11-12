// Los grupos de ejemplo del club y su horario por defecto.
// TODO (multi-club): esto pasará a ser la configuración de cada club.

export const TRAINING_VENUE_URL = "https://www.google.com/maps/search/?api=1&query=pabell%C3%B3n%20municipal";

export const TRAINING_VENUE_ADDRESS = "Pabellón municipal";

export const groups = [
  {
    id: "masculino",
    icon: "medal",
    category: "Volleyball masculino",
    title: "Club Masculino",
    desc: "Equipo masculino de volleyball de Rotta.",
    schedules: [{ days: "Martes y jueves", time: "19:15–20:45" }],
    fee: "36 €/mes",
    notice: "Categoría por confirmar con el club",
    // TODO: la foto actual muestra jugadoras. Sustituir por una imagen de jugadores (o propia del club).
    img: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    alt: "Jugadoras de volleyball celebrando un punto (imagen ilustrativa)",
  },
  {
    id: "femenino",
    icon: "medal",
    category: "Volleyball femenino",
    title: "Club Senior Femenino",
    desc: "Equipo femenino de volleyball de Rotta.",
    schedules: [{ days: "Martes y jueves", time: "20:45–22:15" }],
    fee: "36 €/mes",
    img: "https://images.unsplash.com/photo-1567781830902-685fb3401f1d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    alt: "Jugadoras de volleyball en una pista (imagen ilustrativa)",
  },
  {
    id: "escuela",
    icon: "graduation",
    category: "Escuela de volleyball",
    title: "Club Escuela",
    // TODO: indicar a quién va dirigida (edades/nivel) cuando lo confirme el club.
    desc: "Grupo de escuela de volleyball de Rotta.",
    schedules: [
      { days: "Lunes y miércoles", time: "17:45–19:15" },
      { days: "Martes y jueves", time: "17:45–19:15" },
    ],
    fee: "36 €/mes",
    img: "https://images.unsplash.com/photo-1790595736957-ff12d23500f7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    alt: "Jugadora de volleyball en una pista cubierta (imagen ilustrativa)",
  },
  {
    id: "playa",
    icon: "waves",
    category: "Vóley playa",
    title: "Club Playa",
    desc: "Entrenamientos de vóley playa los martes y jueves.",
    schedules: [{ days: "Martes y jueves", time: "Horario por consultar" }],
    fee: "30 €/mes",
    extraFee: "Entrenamiento suelto: 5 €",
    notice: "Consulta disponibilidad antes de venir; las plazas son limitadas.",
    contactLabel: "Consultar disponibilidad",
    whatsappMessage:
      "Hola, me interesa Club Playa. ¿Hay disponibilidad para venir a entrenar o hacer una sesión suelta? ¿Me podéis indicar el horario y la ubicación?",
    // TODO: la foto actual no es de vóley playa. Sustituir por una foto de playa real.
    img: "https://images.unsplash.com/photo-1771308378506-7f394413342c?auto=format&fit=crop&w=800&q=85",
    alt: "Grupo de personas en una pista (imagen ilustrativa)",
  },
];