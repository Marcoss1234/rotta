# Roadmap maestro de Rotta

Referencia principal de desarrollo. Se actualiza al terminar cada bloque (marcar, poner fecha y mover lo que cambie).
Última revisión: 26-11-2026. **Borrador para que Marcos lo revise**: nada de lo pendiente se empieza hasta que se
confirme el orden.

Cómo leerlo: `[x]` hecho · `[ ]` pendiente · `(?)` decisión de Marcos antes de empezar.

---

## 1. Dónde estamos

Rotta tiene todo lo de la app del TNT, vale para varios clubs (cada uno con su base de datos, equipos, nombre,
escudo y colores) y tiene identidad visual propia. **Todavía no hay ningún club externo**; el TNT sigue en su app.

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

**Operación**
- [x] Copia de seguridad diaria cifrada de todos los clubs (GitHub Actions) y descarga por club para administradores.
- [x] Demo con club inventado (`npm run demo`).
- [x] Despliegue: Render con `main`; también Docker (`DEPLOYMENT.md`).

> Nota: el plan del README tenía como pendientes la política, borrar la cuenta y el permiso de tutores. Eso ya está
> hecho. Lo que queda de privacidad está en el bloque A.

### Cosas que parecían hechas y no lo están
- [ ] **Limpieza de estilos antiguos** (`bg-panel`, `text-zinc-…`, `bg-tnt`, `text-ember`, `buildTheme`). Se intentó con
  reemplazos automáticos el 26-11 y se revirtió porque rompía colores. Hay que hacerla por pantallas y mirándola.
  Es calidad interna: no bloquea nada.
- [ ] Repaso del diseño en móvil pequeño, tableta y escritorio, en claro y oscuro (se hizo pantalla a pantalla al
  rediseñar, pero no una pasada final). Marcos dijo que por ahora da igual.
- [ ] Los tests del servidor no se pudieron ejecutar en la última sesión (faltaban dependencias del entorno); los
  últimos datos buenos son 643 pasan. Rehacer la comprobación antes de dar nada por cerrado.

---

## 2. Pendiente, por bloques y prioridad

### A. Antes de que entre el primer club externo (imprescindible)

| # | Tarea | Por qué | Depende de |
| --- | --- | --- | --- |
| A1 | **Política y aviso legal del club**: que la política muestre el nombre y el contacto del club de quien la lee (TODO en `PrivacyPage.jsx:9`), y decidir si hacen falta aviso legal y condiciones de uso | El club es el responsable de los datos y Rotta trabaja por encargo suyo: tiene que verse quién es | Decisión (?) A5 |
| A2 | **Visibilidad de las notas**: la política dice «nota media» pero el servidor deja ver el detalle por habilidad de cualquier jugador y los rankings de todos los equipos (`docs/ranking-y-notas.md`) | La política tiene que decir lo que pasa de verdad, o el servidor limitarse; es lo más delicado con menores | Decisión (?) A6 |
| A3 | **Instalar la app con la marca del club**: nombre e icono del manifest y moneda («Club Coins») hoy son los de Rotta | Cada club ve su app, no la de otro | Fase 3 (hecha) |
| A4 | **Unirse con enlace o QR por equipo** | Hoy cada persona entra por solicitud de acceso; con 1 club pequeño vale, con varios es mucho trabajo del administrador | Nada |
| A5 | **Revisión por una persona de privacidad/legal** de la política, el reparto de responsabilidades y el contrato con el club (?) | No lo puedo dar por bueno yo | A1, A2 |
| A6 | **Decidir y probar el reparto de datos entre clubs** (que un club nunca vea datos de otro: probar de punta a punta con dos clubs de verdad) | Es la promesa principal de «un club, una base de datos» | Nada |
| A7 | **Entorno de producción de Rotta separado** del TNT: base de datos, dominio/subdominio, copias, `GOOGLE_CLIENT_ID` en Render | Pasar de pruebas a datos reales | A6 |
| A8 | Comprobación completa antes de abrir (tests del servidor y web, build, temas) y un ensayo con un club de prueba como si fuera real | Cerrar la puerta de entrada | A1–A7 |

Pequeños pendientes que se pueden hacer a la vez: muñeco de serie de chica según el equipo `"femenino"` (5 sitios);
error del directo que da «Derrota» si se termina con los sets empatados; texto «Club Coins».

### B. Para comercializar Rotta (después del primer club)

| # | Tarea | Depende de |
| --- | --- | --- |
| B1 | **Pantalla para dar de alta clubs y editar sus equipos** (hoy CLI). Se hace cuando haya más de unos pocos clubs o cuando alguien que no sea Marcos tenga que darlos de alta | A7 |
| B2 | **Web de presentación de Rotta** (qué es, precios, contacto, privacidad) | Decisión de nombre/marca (?) |
| B3 | **Logo definitivo e iconos PNG** para el móvil (ahora un SVG provisional) | Decisión de marca (?) |
| B4 | **Registrar la marca «Rotta»** (OEPM, clases 9 y 42) | Mejor antes de B2 y B3 |
| B5 | **Modelo de precios y contrato/condiciones** con los clubs, y cómo se cobra | Decisión (?) |
| B6 | **Soporte y avisos**: cómo pide ayuda un club, qué pasa si algo falla, vigilar errores y espacio (Atlas gratis aguanta unos 15–18 clubs y 512 MB; las fotos del chat ocupan más) | A7 |
| B7 | **Pasar de Atlas gratis a un plan de pago** cuando haya más de ~10 clubs | B6 |
| B8 | **El TNT como un club más dentro de Rotta** (posible, no urgente) | A6, A7 |

### C. Módulos que cada club activa o desactiva (valor para vender)

El orden depende de lo que pidan los primeros clubs. Todos dependen de C1.

| # | Tarea | Notas |
| --- | --- | --- |
| C1 | **Panel de ajustes del club con interruptores por módulo** (ranking y coins, tienda, pizarra…) | Base de lo demás; hoy no hay interruptores |
| C2 | Convocatorias de partido: el entrenador elige quién va y se les avisa | Usa los avisos push y los partidos que ya existen |
| C3 | Estadísticas de asistencia por jugador | Ya existe la asistencia diaria; falta el resumen por jugador |
| C4 | Lesiones y «no disponible» | Conviene antes de C2 (para no convocar a un lesionado) |
| C5 | Cuotas: quién ha pagado | Delicado (datos económicos): mirar privacidad antes (A1) |
| C6 | Estadísticas de la temporada por jugador | Después de C3 |
| C7 | Llevar partidos y eventos al calendario del móvil | Independiente |

### D. Calidad y mejoras sueltas (cuando haya hueco)
- [ ] Limpieza de estilos antiguos y repaso responsive final (ver arriba).
- [ ] Pizarra: aviso al publicar una jugada y comprobar solapamientos en las rotaciones.
- [ ] Vista previa de Apariencia: repasar un degradado que quedaba en «Partido en directo».

---

## 3. Para pasar de pruebas al primer club externo

Lo mínimo, en este orden: **A6 → A7** (separación de datos probada y producción propia), **A1, A2** (política que diga
la verdad), **A3** (que vea su club), **A4** (que sus jugadores entren fácil), **A5** (revisión legal) y **A8**
(ensayo y comprobación). El alta del club se hace con la CLI (`crear-club.py`, `estructura-club.py`, `crear-admin.py`):
no hace falta B1.

Qué necesito saber de Marcos para ordenar bien esto:
1. ¿Quién será el primer club y para cuándo? Define cuánta prisa tienen A y C.
2. ¿Entra solo con lo actual o pide algo de C (convocatorias, cuotas…)?
3. ¿Qué se hace con la visibilidad de las notas (A2)? Opciones: decir la verdad en la política, o limitar el servidor.
4. ¿Hay alguien que pueda revisar la parte legal (A5)?

## 4. Para empezar a comercializar

Primer club funcionando sin incidencias **+** B2, B3 y B4 (cara pública y marca) **+** B5 (precios y condiciones)
**+** B6 (soporte y vigilancia) **+** B1 (alta de clubs sin Marcos). C1 (interruptores) ayuda a vender porque cada club
paga solo por lo que usa.

## 5. Orden de trabajo propuesto

1. **Ya:** nada nuevo hasta que Marcos confirme este documento.
2. **Primero (A):** A6 y A7, luego A1/A2 y A3, luego A4; en paralelo, A5 y los pequeños pendientes.
3. **A continuación:** C1 y el primer módulo que pida el primer club (probablemente C2 o C3), y B2–B4.
4. **Después:** B1, B5–B7 y el resto de C.
5. **Cuando haya hueco:** bloque D.

La **pantalla de alta de clubs (B1)** queda en el roadmap y se hará cuando corresponda; por ahora se usa la CLI.
