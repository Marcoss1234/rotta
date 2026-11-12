# Rotta · Gestor de clubs

La app para gestionar un club de voley: plantillas, entrenamientos con "Voy / No voy", partidos, ranking semanal con premios, coins y tienda, chat por equipos y pizarra táctica en 2D y 3D.

Nació como la app del C.V. TNT Almería. Rotta es la versión general, pensada para cualquier club. La app del TNT sigue aparte y no se toca desde aquí.

## Arrancar en local

```bash
npm install
pip install -r backend/requirements-dev.txt
```

- **Demo con un club inventado** (no necesita base de datos ni claves): `npm run demo` y abrir http://localhost:5180/app. Guion en [demo/README.md](demo/README.md).
- **Desarrollo normal:** `npm run dev`, con el backend (`uvicorn server:app --app-dir backend --port 8000`) y un `backend/.env` con su propia base de datos. **Nunca** la del TNT.
- **Tests:** `cd backend && python -m pytest -q`.

## Plan

### 1. Imprescindible antes de que entre un club
- [ ] Varios clubs: datos separados por club, y nombre, escudo, colores, equipos y horarios configurables (ahora siguen escritos en el código: `backend/teams.py`, `src/app/teams.js`, `data/groups.js`).
- [ ] Política de privacidad y aviso legal.
- [ ] Borrar la cuenta y los datos desde la app.
- [ ] Permiso de madre, padre o tutor para menores, y consentimiento para las fotos.

### 2. Módulos que cada club activa o desactiva
- [ ] Panel de ajustes del club con interruptores por módulo (ranking y coins, tienda, pizarra, convocatorias, cuotas…).
- [ ] Convocatorias de partido: el entrenador elige quién va y se les avisa.
- [ ] Estadísticas de asistencia por jugador.
- [ ] Lesiones y "no disponible".
- [ ] Cuotas: quién ha pagado.

### 3. Para que los clubs entren fácil
- [ ] Unirse con un enlace o un QR por equipo.
- [ ] Llevar partidos y eventos al calendario del móvil.
- [ ] Web de presentación de Rotta.

### Más adelante
- [ ] Logo definitivo e iconos PNG para el móvil (ahora se usa `public/rotta-logo.svg`).
- [ ] Pizarra: aviso al publicar una jugada y comprobar solapamientos en las rotaciones.
- [ ] Estadísticas de la temporada por jugador.
- [ ] Registrar la marca "Rotta" en la OEPM (clases 9 y 42).
