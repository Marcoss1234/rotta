# Roadmap maestro de Rotta

Referencia principal de desarrollo. Se actualiza al terminar cada bloque (marcar, poner fecha y mover lo que cambie).
Última revisión: 26-11-2026. **Borrador en la rama `claude/amazing-euler-emy9p1`; no está en `main` hasta que Marcos
lo apruebe.** (Mientras tanto, `CLAUDE.md` en `main` ya apunta a este archivo.)

Cómo leerlo: `[x]` hecho · `[ ]` pendiente · `(?)` decisión de Marcos antes de empezar.

## 0. Decisiones de Marcos (26-11-2026)

1. **No hay ningún club externo confirmado ni fecha.** El TNT es nuestro entorno de pruebas, no un cliente externo.
   Por eso el orden se decide por dependencias y calidad, no por prisa.
2. **Sin módulos por adelantado.** Primero la base para que cada club pueda configurar su funcionamiento; las
   necesidades concretas (convocatorias, cuotas, lesiones…) se deciden cuando haya clubs interesados.
3. **Notas de jugadores: se limita el servidor**, no se amplía la política para justificar permisos amplios. La matriz
   propuesta está en el apartado 3 (pendiente de aprobar).
4. **Legal:** todavía no hay persona que revise la documentación. Es un requisito pendiente **antes de incorporar
   clubs externos**.
5. **La pantalla de alta de clubs sigue en el roadmap** (B1), pero por ahora se usa la CLI.
6. **No se empieza ninguna funcionalidad nueva** hasta aprobar este documento.

---

## 1. Dónde estamos

Rotta tiene todo lo de la app del TNT, vale para varios clubs (cada uno con su base de datos, equipos, nombre,
escudo y colores) y tiene identidad visual propia.

### Hecho

**Producto base (traído del TNT y puesto al día con él hasta su commit `34d56fa`)**
- [x] Plantilla, entrenos con Voy/No voy, partidos, calendario, chat por equipos, avisos push.
- [x] Ranking semanal y «Mejor del mes», notas del entrenador, premios, Club Coins y tienda.
- [x] Pizarra táctica 2D/3D (filas, conos, cajones, entrenadores) y partido en directo con informe.
- [x] Personajes 3D estilo videojuego con animaciones y celebraciones.

**Varios clubs**
- [x] Fase 1: una base de datos por club (`backend/clubs.py`); alta con `tools/crear-club.py`.
- [x] Fase 2: equipos, horarios y grupos del ranking de cada club (`backend/teams.py`; `tools/estructura-club.py`).
- [x] Fase 3: nombre y escudo del club, y colores propios (Perfil > Apariencia, solo administradores).

**Privacidad y entrada**
- [x] Política en `/app/privacidad`, permisos al entrar (menores de 14 con tutor, fotos aparte) y borrar la cuenta
  desde la app (`backend/privacy.py`, `PrivacyCard`).
- [x] Entrada y primera experiencia: entrar, crear cuenta, contraseña temporal, pendiente/rechazado, solicitudes,
  bienvenida. Cuenta de administrador sin Google: `tools/crear-admin.py`.

**Diseño**
- [x] Identidad propia (logo en rotación, tipografías) y **Rediseño Premium deportivo** (tres identidades Lima, Naranja
  y Tinta; todas las pantallas rehechas; pantalla fija y móvil compacto). Detalle en `docs/rediseno-premium.md`.
  *Su fase 12 (limpieza) y la 11 (repaso responsive) NO están cerradas: ver «Abierto».*

**Operación**
- [x] Copia de seguridad diaria cifrada de todos los clubs (GitHub Actions) y descarga por club para administradores.
- [x] Demo con club inventado (`npm run demo`).
- [x] Despliegue: Render con `main`; también Docker (`DEPLOYMENT.md`).

> Nota: el plan antiguo del README tenía como pendientes la política, borrar la cuenta y el permiso de tutores. Eso
> ya está hecho. Lo que queda de privacidad está en el bloque A.

### Abierto (no cerrar sin revisarlo)

- [ ] **Limpieza de estilos antiguos** (`bg-panel`, `text-zinc-…`, `bg-tnt`, `text-ember`, `buildTheme`). El 26-11 se
  intentó con reemplazos automáticos y se **revirtió** porque rompía colores (`bg-brand` no existe; los textos oscuros
  pasaban a claros). **No se da por hecha hasta revisarla pantalla por pantalla**, con capturas en claro y oscuro,
  tres identidades y móvil/tableta/escritorio. Pantallas: Inicio, Plantilla, Pizarra y su editor, Ranking, Notas,
  Eventos, Partidos jugados, Directo e informe, Premios, Tienda, Chat, Perfil (4 pestañas), Entrada y estados,
  Usuarios y Solicitudes, Laboratorio de temas. Es calidad interna: no bloquea nada.
- [ ] **Tests del servidor pendientes.** En la última sesión no se pudieron ejecutar: `pip install -r
  requirements.txt` falla al compilar `http-ece` (dependencia de las notificaciones) y sin eso `pytest` no arranca
  (30 errores de importación, `fastapi` no instalado). Último resultado bueno conocido: 643 pasan. Hay que dejar un
  entorno donde `cd backend && python -m pytest -q` corra, y volver a pasarlos, antes de tocar el servidor o abrir.
- [ ] Repaso final del diseño en móvil pequeño, tableta y escritorio (fase 11 del rediseño). Marcos dijo que por ahora
  da igual; se hace junto con la limpieza.

### Estado comprobado el 26-11-2026
- La reversión de la limpieza está aplicada: `src/` de `main` es idéntico al de antes de la limpieza (`d71320c`) y no
  queda ningún `bg-brand`.
- `main` (`d538741`) y la rama de trabajo (`claude/amazing-euler-emy9p1`) tienen el mismo código; la rama solo añade
  `docs/roadmap.md`.
- Web: compila, 231 tests pasan, temas sin fallos (4,8 millones de comprobaciones de contraste). Servidor: sin
  comprobar (ver arriba).

---

## 2. Pendiente, por bloques

### A. Antes de incorporar un club externo (requisitos)

| # | Tarea | Por qué | Depende de |
| --- | --- | --- | --- |
| A1 | **Política con el nombre y el contacto del club** que la lee (TODO en `PrivacyPage.jsx:9`) y decidir si hacen falta aviso legal y condiciones de uso | El club es el responsable de los datos y Rotta trabaja por encargo suyo: tiene que verse quién es | A2 |
| A2 | **Limitar lo que el servidor deja ver de las notas** según la matriz del apartado 3, y dejar la política diciendo exactamente eso | Hoy el servidor enseña más de lo que dice la política; lo más delicado son los menores | Aprobar la matriz; A9 |
| A3 | **Instalar la app con la marca del club**: nombre e icono del manifest y moneda («Club Coins») hoy son los de Rotta | Cada club ve su app, no la de otro | Fase 3 (hecha) |
| A4 | **Unirse con enlace o QR por equipo** | Hoy cada persona entra por solicitud de acceso; con varios clubs es mucho trabajo para el administrador | Nada |
| A5 | **Revisión legal** de política, reparto de responsabilidades y contrato con el club. **Sin persona confirmada**: requisito pendiente | No lo puede dar por bueno el desarrollo | A1, A2 |
| A6 | **Probar el aislamiento entre clubs** de punta a punta con dos clubs (que uno nunca vea datos de otro) | Es la promesa principal de «un club, una base de datos» | Tests del servidor (A9) |
| A7 | **Producción de Rotta separada del TNT**: base de datos, dominio/subdominio, copias, `GOOGLE_CLIENT_ID` en Render | Pasar de pruebas a datos reales | A6 |
| A8 | **Ensayo completo** con un club de prueba como si fuera real y comprobación final (web, servidor, temas) | Cerrar la puerta de entrada | A1–A7 |
| A9 | **Entorno de tests del servidor funcionando** (ver «Abierto») | Sin él no se puede tocar el servidor con seguridad | Nada |
| A10 | **Base de configuración del club** (C1) en su versión mínima: un sitio donde guardar ajustes por club, que A2 usará para la visibilidad de las notas | Decisión 2: la base antes que los módulos | Nada |

Pequeños pendientes que se pueden hacer a la vez: muñeco de serie de chica según el equipo `"femenino"` (5 sitios);
error del directo que da «Derrota» si se termina con los sets empatados; texto «Club Coins».

### B. Para comercializar (después de tener el primer club externo)

| # | Tarea | Depende de |
| --- | --- | --- |
| B1 | **Pantalla para dar de alta clubs y editar sus equipos** (hoy CLI). Se hace cuando alguien que no sea Marcos tenga que dar altas, o haya más de unos pocos clubs | A7 |
| B2 | **Web de presentación de Rotta** (qué es, precios, contacto, privacidad) | Decisión de marca (?) |
| B3 | **Logo definitivo e iconos PNG** para el móvil (ahora un SVG provisional) | Decisión de marca (?) |
| B4 | **Registrar la marca «Rotta»** (OEPM, clases 9 y 42); mejor antes de B2 y B3 | Nada |
| B5 | **Precios, contrato y cobro** | Decisión (?) |
| B6 | **Soporte y vigilancia**: cómo pide ayuda un club, qué pasa si algo falla, errores y espacio (Atlas gratis aguanta unos 15–18 clubs y 512 MB; las fotos del chat ocupan más) | A7 |
| B7 | **Pasar de Atlas gratis a plan de pago** al acercarse a ~10 clubs | B6 |
| B8 | **El TNT como un club más dentro de Rotta** (posible, no urgente) | A6, A7 |

### C. Configuración por club y módulos

- [ ] **C1. Base de configuración del club** (se hace como A10): ajustes guardados por club, con una pantalla de
  administrador y una forma ordenada de que el resto de la app los consulte. Es lo único de este bloque que se
  desarrolla ahora. Primer uso: la visibilidad de las notas (A2).
- **Interruptores por módulo** (ranking y coins, tienda, pizarra…): se construyen sobre C1 cuando haya un club que
  pida desactivar algo.
- **Ideas aparcadas hasta que haya clubs interesados** (no se desarrollan por adelantado): convocatorias de partido,
  estadísticas de asistencia por jugador, lesiones y «no disponible», cuotas (delicado: datos económicos), estadísticas
  de la temporada por jugador, llevar partidos y eventos al calendario del móvil.

### D. Calidad y mejoras sueltas (cuando haya hueco)
- [ ] Limpieza de estilos y repaso responsive (ver «Abierto»).
- [ ] Pizarra: aviso al publicar una jugada y comprobar solapamientos en las rotaciones.
- [ ] Vista previa de Apariencia: repasar un degradado que quedaba en «Partido en directo».

---

## 3. Matriz de permisos de las notas (propuesta, pendiente de aprobar)

### Cómo es hoy (revisado en `backend/ranking.py`)

Roles: `admin` (el principal está en `ADMIN_EMAILS`; los demás administran solo sus equipos), `entrenador`, `jugador`,
`familia`.

| Dato | Jugador | Entrenador | Administrador | Familia |
| --- | --- | --- | --- | --- |
| Ranking (puesto, nota global, foto, nombre, posición) de **todos los grupos** | Sí | Sí | Sí | No |
| Detalle por habilidad, radar y evolución (12 semanas) de **cualquier jugador de cualquier grupo** | **Sí** | **Sí** | **Sí** | No |
| Comentario de una nota | Solo el suyo | Solo si puntúa ese grupo | **De cualquier grupo, aunque no lo entrene** | No |
| Hoja con borradores y puntuar | No | Sus equipos | Principal: todos; resto: los suyos | No |
| Ficha del jugador (títulos, estatura, personaje, foto) | **Cualquier persona aprobada, también familia, de cualquier equipo** | igual | igual | igual |

Problemas: (1) el detalle por habilidad de cualquier menor lo ve todo el club; (2) la familia no ve nada de su propio
hijo pero sí la ficha de cualquiera; (3) un administrador secundario lee comentarios de equipos que no entrena;
(4) la política solo habla de «nota media».

### Propuesta

Cada celda es lo máximo que se puede ver; el servidor lo aplica, no solo la web.

| Dato | El propio jugador | Compañeros del mismo equipo | Otros equipos del club | Entrenador del equipo | Administrador principal | Administrador secundario | Familia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Podio y títulos (top 3 de la semana, mejor del mes) | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| Puesto y nota global en el ranking | Sí | Sí (*) | No | Sí | Sí | Solo sus equipos | No (de momento) |
| Detalle por habilidad, radar y evolución | **Sí** | **No** | **No** | Sí | Sí | Solo sus equipos | No (de momento) |
| Comentario | **Sí** | No | No | Sí | Sí | Solo sus equipos | No |
| Hoja con borradores y puntuar | No | No | No | Sus equipos | Todos | Sus equipos | No |
| Ficha: nombre, foto, posición, personaje, títulos | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| Ficha: estatura | Sí | Sí | No | Sí | Sí | Solo sus equipos | No |

(*) **Menores de 14** (los que tienen el permiso de tutor, `consent.adult = false`): su puesto y nota global solo los
ven ellos, su entrenador y los administradores; para sus compañeros aparecen únicamente si están en el podio. Para
jugadores sin cuenta vinculada no se sabe la edad: se tratan como menores.

### Qué cambia respecto a hoy
- El detalle por habilidad y el comentario dejan de verse entre compañeros y entre equipos.
- Otros equipos solo enseñan podio y títulos (hoy enseñan todo el ranking).
- La ficha de un jugador deja de enseñar estatura a otros equipos y a familias.
- El administrador secundario deja de leer comentarios de equipos que no entrena.
- Los menores de 14 dejan de ser visibles en el ranking para sus compañeros salvo en el podio.

### Decisiones para Marcos (?)
1. **¿Compañeros del mismo equipo ven la nota global de los demás?** La propuesta dice sí (es lo que da sentido al
   ranking), salvo los menores de 14. Alternativa más estricta: que cada club decida (ajuste de C1) y por defecto no.
2. **¿Familias?** Hoy no ven nada. Lo coherente sería que vieran la nota y el comentario de **su** hijo, pero no hay
   vínculo familia–jugador en los datos: es una funcionalidad nueva (aparcada). Mientras tanto, siguen sin ver ranking.
3. **¿Menores de 14 sin cuenta vinculada se tratan como menores?** Propuesto que sí.

### Cómo se implementaría (cuando se apruebe)
Un único sitio en el servidor que decida qué puede ver quién (hoy repartido entre `_can_view`, `_can_rate`, `with_comment`
y `get_player_profile`), con tests por rol y edad, y la política (`PrivacyPage.jsx`) reescrita a la vez para decir
exactamente esto. La visibilidad entre compañeros sería el primer ajuste de la base de configuración (A10).

---

## 4. Para pasar de pruebas a un club externo

Lo mínimo, por dependencias: **A9** (tests del servidor) → **A6** (aislamiento probado) → **A7** (producción propia);
**A10** (base de configuración) → **A2** (permisos de notas) → **A1** (política con el club); en paralelo **A3** y **A4**;
**A5** (revisión legal, sin persona todavía); y **A8** (ensayo y comprobación). El alta del club se hace con la CLI
(`crear-club.py`, `estructura-club.py`, `crear-admin.py`): no hace falta B1.

## 5. Para empezar a comercializar

Primer club funcionando sin incidencias **+** B2, B3 y B4 (cara pública y marca) **+** B5 (precios y contrato)
**+** B6 (soporte y vigilancia) **+** B1 (alta de clubs sin Marcos). Los módulos (C) se añaden según lo que pidan los
clubs interesados.

## 6. Orden de trabajo propuesto (a aprobar)

1. **Preparar:** A9 (entorno de tests del servidor) y la limpieza visual pantalla por pantalla (calidad, sin prisa).
2. **Base:** A10/C1 (configuración por club) y A2 (permisos de notas, con la matriz aprobada).
3. **Privacidad y entrada:** A1, A3, A4.
4. **Producción:** A6, A7 y, cuando haya persona, A5. Cierre con A8.
5. **Cuando haya club interesado:** módulos que pida (C), B1 si hace falta, y el bloque B por orden de dependencias.
6. **Cuando haya hueco:** bloque D.

La **pantalla de alta de clubs (B1)** queda en el roadmap y se hará cuando corresponda; por ahora se usa la CLI.
