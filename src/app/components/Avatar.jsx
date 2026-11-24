import { useEffect, useState } from "react";
import { avatarColor, contrast } from "@/app/theme.js";

const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

// Sin foto, o si no carga, se ven las iniciales.
export default function Avatar({ name, picture, className = "h-10 w-10 text-sm" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [picture]);

  if (picture && !failed) {
    return (
      <img
        src={picture}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  // Sin foto, cada persona tiene siempre su color; el texto, blanco o negro según se lea mejor.
  const color = avatarColor(name);
  return (
    <span
      aria-hidden="true"
      style={{ background: color, color: contrast(color, "#FFFFFF") >= 3 ? "#FFFFFF" : "#111318" }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
    >
      {initials(name)}
    </span>
  );
}
