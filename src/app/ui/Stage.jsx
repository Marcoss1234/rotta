import { cx } from "./cx.js";

/**
 * El escenario (Premium deportivo): la pieza protagonista de una pantalla, siempre oscura (también con la app en
 * claro), con el resplandor del club y el de la identidad (clase .stage en index.css; sus colores los ajusta
 * theme.js para que todo el texto se lea). Por dentro valen los colores oscuros de la identidad (.force-dark), así
 * que las piezas comunes funcionan igual dentro. Como mucho uno por pantalla, y solo para lo más importante.
 * Props: as (etiqueta HTML), decoration (el adorno de la identidad: líneas de pista en Lima, costuras del balón en
 * Naranja, cuadrícula del acta en Tinta; muy suave y solo de adorno), className, children.
 */
export function Stage({ as: Tag = "section", decoration = true, className, children, ...rest }) {
  return (
    <Tag className={cx("stage force-dark relative isolate overflow-hidden rounded-card text-ink", className)} {...rest}>
      {decoration && <StageDecoration />}
      {children}
    </Tag>
  );
}

// Los tres adornos están siempre; index.css enseña solo el de la identidad del club. El color es el de las líneas
// del escenario (no lleva información: el segundo color del club, `stripe`, podría ir aquí como adorno).
function StageDecoration() {
  return (
    <span aria-hidden="true" className="stage-decoration pointer-events-none absolute inset-0 -z-10 text-stage-line">
      <svg className="stage-deco-lineas" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMin slice">
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="230" y="-20" width="220" height="250" />
          <line x1="230" y1="105" x2="450" y2="105" />
          <line x1="303" y1="-20" x2="303" y2="230" />
        </g>
      </svg>
      <svg className="stage-deco-balon" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMin slice">
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="370" cy="20" r="150" />
          <path d="M240 -40 C320 40 330 130 280 185" />
          <path d="M520 70 C420 60 330 100 285 175" />
          <path d="M330 -110 C400 -10 430 80 425 168" />
        </g>
      </svg>
      <svg className="stage-deco-acta" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMin slice">
        <g stroke="currentColor" strokeWidth="1">
          <line x1="0" y1="60" x2="400" y2="60" />
          <line x1="0" y1="120" x2="400" y2="120" />
          <line x1="0" y1="180" x2="400" y2="180" />
          <line x1="0" y1="240" x2="400" y2="240" />
          <line x1="280" y1="0" x2="280" y2="300" />
          <line x1="320" y1="0" x2="320" y2="300" />
          <line x1="360" y1="0" x2="360" y2="300" />
        </g>
      </svg>
    </span>
  );
}
