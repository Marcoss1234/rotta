/** Junta clases y quita las vacías: cx("a", cond && "b") → "a b". */
export const cx = (...classes) => classes.filter(Boolean).join(" ");
