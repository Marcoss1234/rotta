# Roadmap maestro de Rotta

Referencia principal de desarrollo. Se actualiza al terminar cada bloque (marcar, poner fecha y mover lo que cambie).
Última revisión: 26-11-2026. **Borrador en la rama `claude/amazing-euler-emy9p1`; no está en `main` hasta que Marcos
lo apruebe.** (Mientras tanto, `CLAUDE.md` en `main` ya apunta a este archivo.)

Cómo leerlo: `[x]` hecho · `[ ]` pendiente · `(?)` decisión de Marcos antes de empezar.

## 0. Fuente de verdad y registro de decisiones

**Este archivo es la única fuente de verdad** de las decisiones de producto, privacidad, funcionalidades y diseño de
Rotta, abramos los chats que abramos. Reglas:
- Una decisión que no esté aquí **no existe**: si Marcos la dio en un chat, se apunta aquí en el momento.
- Las dudas no se resuelven por cuenta propia: se apuntan en «Dudas por recuperar» y se preguntan.
- `CLAUDE.md` guarda solo el contexto técnico y remite aquí; los detalles de diseño están en
  `docs/rediseno-premium.md` y los de ranking en `docs/ranking-y-notas.md` (se resumen aquí lo que decidan).
- Cada decisión lleva fecha y origen: *documentada* (ya estaba en el repositorio) o *dada en chat* (Marcos la dijo y se
  apunta hoy; no se ha podido comprobar en conversaciones anteriores, solo por lo que él cuenta).

### Decisiones vigentes

| Id | Decisión | Fecha | Origen |
| --- | --- | --- | --- |
| D1 | La app del TNT (`proyecto-voley-tnt`, rama `app-privada`) queda en mantenimiento: solo lo que pida David o arreglos. Lo nuevo va a Rotta. Un fallo que exista en las dos apps se arregla en ambas | — | `CLAUDE.md` |
| D2 | Más adelante el TNT podría ser un club más dentro de Rotta; mientras tanto es el entorno de pruebas, no un cliente externo | 26-11 | `CLAUDE.md` + dada en chat |
| D3 | Commit y push solo cuando Marcos lo pide (salvo que un hook del entorno lo exija); nunca subir `backend/.env` | — | `CLAUDE.md` |
| D4 | Marcos habla en español y quiere explicaciones sencillas | — | `CLAUDE.md` |
| D5 | Cada bloque del rediseño se publicó también en `main` (Render publica `main` solo) | 26-11 | `docs/rediseno-premium.md` |
| D6 | Diseño: pantalla fija en el móvil; móvil compacto (raíz de 15 px, letra mínima 12 px, campos 16 px); sin degradados de marca; no estirar pistas ni dibujos; no gastar franjas en cosas pequeñas; reordenar y no solo repintar | 26-11 | `docs/rediseno-premium.md` |
| D7 | Ranking y Notas: «Overall» pasa a «Nota global»; dorado solo para 85 o más; «Tu ficha» con acceso rápido arriba y la ficha al final; el equipo por defecto sale de la estructura del club | 26-11 | `docs/ranking-y-notas.md` (**ver duda Q7**) |
| D8 | No hay módulos por adelantado: primero la base de configuración por club; los módulos concretos se deciden cuando haya clubs interesados | 26-11 | dada en chat |
| D9 | No hay club externo confirmado ni fecha | 26-11 | dada en chat |
| D10 | Notas: se limita el servidor; no se amplía la política para justificar permisos amplios | 26-11 | dada en chat |
| D11 | La revisión legal es un requisito pendiente antes de incorporar clubs externos (aún sin persona) | 26-11 | dada en chat |
| D12 | La pantalla de alta de clubs queda en el roadmap (B1); por ahora, la CLI | 26-11 | dada en chat |
| D13 | La limpieza de estilos no se da por cerrada hasta revisarla pantalla por pantalla | 26-11 | dada en chat |
| D14 | **Evaluaciones: los compañeros NO ven las de otros jugadores, ni la nota global.** Cada jugador ve solo las suyas. El entrenador ve las de los jugadores de los equipos que entrena | «ayer» (25-11) | dada en chat |
| D15 | **Familias: de momento no ven evaluaciones.** Aparcado hasta que exista relación familia–jugador y un sistema de permisos propio | «ayer» | dada en chat |
| D16 | **Jugadores sin cuenta vinculada: se aplican provisionalmente las restricciones más protectoras**, como si fueran menores, **sin afirmar que se conoce su edad** (ni en la app ni en la política) | «ayer» | dada en chat |
| D17 | **La Escuela puede conservar su ranking público** | «ayer» | dada en chat (**ver Q1, Q2**) |
| D18 | **Masculino y Femenino no tendrán ranking público semanal** | «ayer» | dada en chat (**ver Q3**) |
| D19 | **Las evaluaciones individuales son privadas** | «ayer» | dada en chat |
| D20 | **El MVP de los partidos sigue siendo público** | «ayer» | dada en chat (**ver Q6**) |
| D21 | **Las evaluaciones son de 0 a 100 y no tienen frecuencia semanal obligatoria** | «ayer» | dada en chat (**ver Q4**) |
| D22 | **Se conserva el histórico de evaluaciones** | «ayer» | dada en chat (**ver Q5**) |

### Dudas por recuperar (no se han resuelto ni inventado; hay que preguntarlas)

| Id | Duda |
| --- | --- |
| Q1 | **D17 choca con D14.** Si el ranking de la Escuela es «público», los jugadores de la Escuela verían el puesto o la nota global de sus compañeros. ¿Es una excepción a D14 solo para la Escuela? ¿Se enseña puesto y nota global, solo el puesto, o solo un podio? |
| Q2 | **¿Qué significa «público»?** ¿Visible para todo el club (cualquier miembro aprobado), solo para el equipo/grupo, también para familias, o fuera de la app? Hoy Rotta no tiene web pública. Además, la Escuela son sobre todo menores: ¿entran en el ranking público aunque D16 los trate como protegidos si no tienen cuenta vinculada? |
| Q3 | **¿Qué pasa con lo que nace del ranking semanal en Masculino y Femenino?** Hoy el podio semanal, la corona, las monedas de premio (100/60/40 semanal; 250/150/100 «mejor del mes»), el título «Jugadora del mes» y los títulos de la ficha salen de ese ranking. ¿Desaparecen en esos equipos, se quedan solo como títulos sin nota, o se sustituyen por otra cosa? |
| Q4 | **0 a 100: ¿de qué?** Hoy cada habilidad se puntúa de 1 a 10 (de medio en medio) y la **nota global** (0 a 100) se calcula con pesos por posición. ¿Las habilidades pasan también a 0–100, o la escala nueva es solo la nota global? Y sin frecuencia semanal obligatoria: ¿cada evaluación se guarda con su fecha y deja de haber «semana publicada»? ¿Quién decide cuándo se evalúa y cómo se calcula «Mejor del mes» y el ranking de la Escuela sin semanas? |
| Q5 | **Histórico y borrar la cuenta.** Hoy borrar la cuenta borra sus evaluaciones y premios (`backend/privacy.py`). ¿El histórico se conserva mientras exista la cuenta y se borra con ella (lo que exige el derecho a borrar), o se conserva de forma anónima? ¿Cuánto histórico ve el jugador de sí mismo (hoy se enseñan 12 semanas)? |
| Q6 | **MVP «público»**: mismo significado que Q2. ¿Lo ven también las familias? (Hoy ven los partidos.) ¿Sigue contando en la ficha («MVP: n») y en las monedas? |
| Q7 | **Ranking y Notas ya se rediseñó** (podio de 3, filas, «Tu ficha»; D7) pensando en que todos ven el ranking. D14 y D18 cambian la pantalla entera para Masculino/Femenino. ¿Se rehace esa pantalla con estas decisiones? |
| Q8 | **Administradores:** D14 solo habla de jugadores y entrenadores. Hoy el administrador principal puede puntuar todos los equipos y el secundario los que entrena, y **cualquier** administrador lee comentarios de cualquier equipo. ¿Ven las evaluaciones de todos los equipos o solo de los que entrenan? |
| Q9 | **Entrenadores de varios equipos y entrenadores que también son jugadores**: ¿qué ven de sí mismos y de los demás? |
| Q10 | **Playa** no está en ningún grupo (no tiene ranking). ¿Se evalúa o no? ¿Y los equipos nuevos de otros clubs: cuál es la regla por defecto (¿privado, como Masculino/Femenino, y el club activa el ranking público?) |
| Q11 | **Resto de la ficha del jugador** (estatura, foto, personaje, títulos): hoy la ve cualquier persona aprobada de cualquier equipo, incluidas familias. Mi propuesta anterior de limitar la estatura **no fue una decisión de Marcos**. ¿Qué se enseña de otros jugadores? |
| Q12 | **El README tiene un «Plan» antiguo** (marca como pendiente lo que ya está hecho). Para que haya una sola fuente de verdad, ¿lo sustituimos por un enlace a este archivo? |
| Q13 | **Decisiones de chats anteriores que no estén aquí** y que Marcos recuerde (por ejemplo sobre precios, marca, módulos o diseño): hay que apuntarlas cuando salgan. |

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
| A2 | **Limitar lo que el servidor deja ver de las evaluaciones** según la matriz del apartado 3 (D14–D22) y dejar la política diciendo exactamente eso. Incluye cambiar la escala (0 a 100) y la frecuencia (sin semana obligatoria) | Hoy el servidor enseña más de lo que dice la política; lo más delicado son los menores | Aprobar la matriz y resolver Q1–Q6 y Q8; A9; A10 |
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

## 3. Matriz de permisos de las evaluaciones (con las decisiones D14–D22; pendiente de aprobar)

Lo que está marcado **(?)** depende de una duda de la sección 0 y **no se decide aquí**. El servidor aplicará la matriz
(no solo la web) y la política se reescribirá a la vez para decir exactamente esto.

### 3.1 Cómo es hoy (revisado en `backend/ranking.py`)

Roles: `admin` (el principal está en `ADMIN_EMAILS`; los demás puntúan solo los equipos que entrenan), `entrenador`,
`jugador`, `familia`. Hoy:
- **Todos menos familia** ven el ranking de **todos** los grupos (puesto, nota global, foto, nombre, posición) y el
  detalle por habilidad, el radar y la evolución (12 semanas) de **cualquier jugador**.
- El comentario lo ve el propio jugador, quien puntúa ese grupo y **cualquier administrador** (aunque no entrene).
- La ficha del jugador (títulos, estatura, personaje, foto) la ve cualquier persona aprobada, familias incluidas.
- Las familias no ven nada del ranking.

### 3.2 Evaluaciones individuales (nota global, detalle por habilidad, comentario, histórico)

«Suyas» = las de la persona con la cuenta vinculada a ese jugador. «Sus equipos» = los que entrena.

| Quién mira → | Jugador | Entrenador | Admin principal | Admin secundario | Familia |
| --- | --- | --- | --- | --- | --- |
| **Sus propias evaluaciones** (nota global, detalle, comentario, histórico) | **Sí** (D14) | Sí, si es también jugador | Sí, si es también jugador | Sí, si es también jugador | No (D15) |
| **Evaluaciones de otro jugador de su mismo equipo** | **No** (D14) | **Sí** (D14) | (?) Q8: hoy puede puntuar todos | (?) Q8: hoy, los que entrena | No (D15) |
| **Evaluaciones de otro jugador de otro equipo** (aunque sea del mismo grupo) | **No** (D14) | **No**, salvo equipos que entrena (D14) | (?) Q8 | (?) Q8 | No (D15) |
| **Evaluaciones de un jugador sin cuenta vinculada** | **No** | Sí si es de sus equipos | (?) Q8 | (?) Q8 | No |
| **Puntuar, borradores y publicar** | No | Sus equipos | Todos (como hoy, (?) Q8) | Sus equipos | No |
| **Comentario** | Solo el suyo | Sus equipos | (?) Q8 | (?) Q8; hoy lee cualquiera | No |

Cada evaluación mantiene su fecha y el histórico se conserva (D22); lo que cada persona ve de su historial y cómo se
trata al borrar la cuenta está en Q5.

### 3.3 Rankings y premios, por equipo

Un equipo pertenece a un grupo de ranking (estructura del club). Con la estructura de serie:

| Equipo (grupo) | Ranking | Evaluaciones individuales | MVP de los partidos |
| --- | --- | --- | --- |
| **Masculino** (grupo Masculino) | **Sin ranking público semanal** (D18). Lo que hoy nace de él (podio, corona, monedas, «Jugador del mes», títulos): (?) Q3 | **Privadas** (D19): las ve cada jugador y su entrenador | **Público** (D20) (?) Q2, Q6 |
| **Femenino** (grupo Femenino) | **Sin ranking público semanal** (D18); igual (?) Q3 | **Privadas** (D19) | **Público** (D20) |
| **Escuela LM** y **Escuela MJ** (grupo Escuela: comparten ranking) | **Puede conservar su ranking público** (D17). A quién se enseña y qué (puesto, nota global, podio): (?) Q1, Q2 | **Privadas** (D19); el detalle y el comentario solo el propio jugador y su entrenador | **Público** (D20) |
| **Playa** (sin grupo, sin ranking hoy) | Sin ranking | (?) Q10 | **Público** (D20) |
| **Equipo nuevo de otro club** | Regla por defecto: (?) Q10 | **Privadas** (D19) | **Público** (D20) |

Nota: la excepción de la Escuela contradice a D14 («ni siquiera la nota global») si el ranking público enseña la nota
global; la contradicción se resuelve con Q1, no aquí.

### 3.4 Otras cosas visibles del jugador

| Dato | Quién lo ve | Estado |
| --- | --- | --- |
| Nombre, foto (solo con permiso de fotos), posición, personaje | Todo el club, como hoy | Sin decidir cambiar |
| Estatura | Hoy cualquier persona aprobada | (?) Q11 |
| Títulos y contadores de la ficha (victorias de semana, «Mejor del mes», MVP) | Hoy cualquier persona aprobada | MVP: público (D20). Los de semana y mes: (?) Q3 |
| Jugador sin cuenta vinculada | Se tratan con las restricciones más protectoras (D16), **sin decir que son menores** | Redacción de la política: pendiente |

### 3.5 Qué cambia respecto a hoy (resumen, sin implementar)

- El detalle por habilidad, el radar, la evolución y el comentario de un jugador dejan de verse entre compañeros, entre
  equipos y entre grupos.
- Masculino y Femenino pierden la pantalla de ranking semanal público (el resto de lo que dependía de ella, Q3).
- La escala y la frecuencia de las evaluaciones cambian (0 a 100, sin semana obligatoria; Q4), lo que afecta al modelo
  de datos, a la hoja de Notas, al «Mejor del mes» y a las gráficas. Es un cambio grande, no un ajuste de permisos.
- La política (`PrivacyPage.jsx`) tiene que reescribirse con exactamente lo que se apruebe.

### 3.6 Dependencias para implementarlo
Aprobar la matriz y resolver Q1–Q6 y Q8 → base de configuración del club (A10) → cambio de servidor en un único sitio
que decida quién ve qué (hoy repartido entre `_can_view`, `_can_rate`, `with_comment` y `get_player_profile`), con
tests por rol y por equipo → rehacer Ranking y Notas en la web (Q7) → política. Los tests del servidor tienen que
funcionar antes (A9).

---

## 4. Para pasar de pruebas a un club externo

Lo mínimo, por dependencias: **A9** (tests del servidor) → **A6** (aislamiento probado) → **A7** (producción propia);
**A10** (base de configuración) → **A2** (permisos y modelo de evaluaciones; antes, resolver las dudas Q1–Q8) → **A1** (política con el club); en paralelo **A3** y **A4**;
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
