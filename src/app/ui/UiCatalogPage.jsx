import { useId, useState } from "react";
import { CalendarDays, Plus, Settings2, Trash2, Trophy } from "lucide-react";
import { STYLES, THEMES } from "@/app/themes.js";
import { useThemeControls } from "@/app/useTheme.js";
import { Badge, Button, Card, CardHeader, ChipGroup, Dialog, EmptyState, Field, IconButton, Input, Notice, PasswordInput, Select, TabPanel, Tabs, Textarea } from "./index.js";

// Catálogo de los componentes comunes, con el tema y el modo de verdad (solo en desarrollo y en la demo).
// Sirve para revisarlos en Lima, Naranja y Tinta, en claro y en oscuro, antes de llevarlos a más pantallas.
export default function UiCatalogPage() {
  const { club, choice, chooseMode, previewClub } = useThemeControls();
  const [tab, setTab] = useState("entrenos");
  const tabsId = useId();
  const [team, setTeam] = useState("femenino");
  const [filters, setFilters] = useState(["colocador"]);
  const [dialog, setDialog] = useState(null);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-8 font-body text-ink md:px-8">
      <header className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold">Componentes de Rotta</h1>
        <p className="text-sm text-ink-muted">Solo en desarrollo. Cambia el tema y el modo para revisarlos (no se guarda nada en el club).</p>
        <ChipGroup label="Tema" options={STYLES.map((style) => ({ value: style, label: THEMES[style].name }))} value={club.style ?? "tinta"} onChange={(style) => previewClub({ ...club, style })} />
        <ChipGroup label="Modo" options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Oscuro" }]} value={choice} onChange={chooseMode} />
      </header>

      <Card>
        <CardHeader title="Botones" subtitle="Una acción principal por zona; el resto, secundarias o discretas." />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={Plus}>Principal</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="quiet">Discreto</Button>
          <Button variant="danger" icon={Trash2}>Borrar</Button>
          <Button variant="danger-quiet">Borrar evento</Button>
          <Button busy busyLabel="Guardando…">Guardar</Button>
          <Button disabled>Desactivado</Button>
          <IconButton icon={Settings2} label="Ajustes" variant="secondary" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm">Pequeño</Button>
          <Button size="lg">Grande</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pestañas y selectores" />
        <div className="mt-4 space-y-4">
          <Tabs id={tabsId} label="Qué ver" value={tab} onChange={setTab} items={[{ id: "entrenos", label: "Entrenamientos", icon: CalendarDays }, { id: "partidos", label: "Partidos", icon: Trophy, count: 2 }, { id: "torneos", label: "Torneos", disabled: true }]} />
          <TabPanel tabsId={tabsId} tab="entrenos" value={tab} className="rounded-field text-sm text-ink-muted">Martes y jueves a las 20:45.</TabPanel>
          <TabPanel tabsId={tabsId} tab="partidos" value={tab} className="rounded-field text-sm text-ink-muted">Sábado 28 contra CV Bahía.</TabPanel>
          <TabPanel tabsId={tabsId} tab="torneos" value={tab} />
          <ChipGroup label="Equipo" scroll value={team} onChange={setTeam} options={[{ value: "masculino", label: "Masculino" }, { value: "femenino", label: "Femenino" }, { value: "escuela", label: "Escuela LM" }, { value: "playa", label: "Playa" }]} />
          <ChipGroup label="Posiciones" multiple value={filters} onChange={setFilters} options={[{ value: "colocador", label: "Colocador", count: 2 }, { value: "central", label: "Central", count: 2 }, { value: "libero", label: "Líbero", count: 1 }]} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Formulario" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="cat-nombre" label="Nombre">
            <Input id="cat-nombre" placeholder="Carmen López" />
          </Field>
          <Field id="cat-equipo" label="Equipo" hint="Puedes cambiarlo más tarde.">
            <Select id="cat-equipo" hint="Puedes cambiarlo más tarde." defaultValue="femenino">
              <option value="femenino">Sénior Femenino</option>
              <option value="masculino">Sénior Masculino</option>
            </Select>
          </Field>
          <Field id="cat-dorsal" label="Dorsal" error="Ese dorsal ya lo tiene otra jugadora.">
            <Input id="cat-dorsal" defaultValue="10" error="Ese dorsal ya lo tiene otra jugadora." />
          </Field>
          <Field id="cat-clave" label="Contraseña" hint="Al menos 8 caracteres.">
            <PasswordInput id="cat-clave" autoComplete="new-password" hint="Al menos 8 caracteres." />
          </Field>
          <Field id="cat-notas" label="Notas" optional>
            <Textarea id="cat-notas" rows={2} />
          </Field>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card level="base" padding="sm"><Badge tone="club">Partido</Badge><p className="mt-1 font-display text-lg font-extrabold">Tarjeta base</p><p className="text-sm text-ink-muted">Bloque principal.</p></Card>
        <Card level="accent" padding="sm"><Badge tone="rotta">en 35 min</Badge><p className="mt-1 font-display text-lg font-extrabold">Tarjeta destacada</p><p className="text-sm text-ink-muted">Lo tuyo o lo elegido.</p></Card>
        <Card level="raised" padding="sm"><Badge>Evento</Badge><p className="mt-1 font-display text-lg font-extrabold">Relleno</p><p className="text-sm text-ink-muted">Dentro de otra tarjeta.</p></Card>
        <Card level="outline" padding="sm"><Badge tone="voy">Vas</Badge><p className="mt-1 font-display text-lg font-extrabold">Contorno</p><p className="text-sm text-ink-muted">Listas ligeras.</p></Card>
      </section>

      <section className="space-y-2">
        <Notice tone="error">No se ha podido guardar. Revisa la conexión y vuelve a intentarlo.</Notice>
        <Notice tone="success">Guardado: todo el equipo ya lo ve.</Notice>
        <Notice>El próximo entreno es en el pabellón municipal.</Notice>
        <EmptyState action={<Button size="sm" variant="secondary" icon={Plus}>Añadir evento</Button>}>No hay nada este mes.</EmptyState>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setDialog("center")}>Abrir ventana</Button>
        <Button variant="secondary" onClick={() => setDialog("side")}>Abrir panel lateral</Button>
      </div>
      {dialog && (
        <Dialog
          title={dialog === "side" ? "Panel lateral" : "Ventana"}
          description="Se cierra con Escape o con la X."
          placement={dialog}
          onClose={() => setDialog(null)}
          footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => setDialog(null)}>Guardar</Button></div>}
        >
          <Field id="cat-dialogo" label="Qué es"><Input id="cat-dialogo" placeholder="Cena de equipo" /></Field>
        </Dialog>
      )}
    </main>
  );
}
