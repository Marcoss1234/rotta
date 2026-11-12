import { useEffect, useState } from "react";

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
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-100 ${className}`}>
      {initials(name)}
    </span>
  );
}
