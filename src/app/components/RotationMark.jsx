// La marca de Rotta: las seis zonas de la pista en rotación. La zona 1 (la que saca) va resaltada.
const ZONES = Array.from({ length: 6 }, (_, index) => {
  const angle = ((index * 60 - 90) * Math.PI) / 180;
  return [12 + 8 * Math.cos(angle), 12 + 8 * Math.sin(angle)];
});

export default function RotationMark({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {ZONES.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={index === 0 ? 2.6 : 1.7} fill="currentColor" opacity={index === 0 ? 1 : 0.45} />
      ))}
    </svg>
  );
}
