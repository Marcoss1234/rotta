import { useClubIdentity } from "@/app/clubIdentity.js";

// El escudo del club, o el logo de Rotta si no tiene. El de Rotta va recortado (`rottaClassName`);
// el del club, entero, como lo hayan dibujado.
export default function ClubCrest({ className = "", rottaClassName = "rounded-full object-cover", alt = "" }) {
  const { crest, custom } = useClubIdentity();
  return <img src={crest} alt={alt} className={`${className} ${custom.crest ? "object-contain" : rottaClassName}`} />;
}
