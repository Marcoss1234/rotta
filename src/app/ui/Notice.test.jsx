import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, EmptyState, Notice } from "./Notice.jsx";

describe("Notice", () => {
  it("un error se anuncia en voz alta (role=alert) con el tono de peligro", () => {
    render(<Notice tone="error">No se ha podido guardar.</Notice>);
    const notice = screen.getByRole("alert");
    expect(notice.textContent).toBe("No se ha podido guardar.");
    expect(notice.className).toContain("text-danger-text");
  });

  it("éxito e información son avisos tranquilos (role=status)", () => {
    render(<><Notice tone="success">Guardado.</Notice><Notice>Es en el pabellón.</Notice></>);
    const [success, info] = screen.getAllByRole("status");
    expect(success.textContent).toBe("Guardado.");
    expect(success.className).toContain("text-voy-text");
    expect(info.textContent).toBe("Es en el pabellón.");
    expect(info.className).toContain("text-ink");
  });

  it("la advertencia tiene su propio tono (ámbar, distinto del error) y se anuncia como status", () => {
    render(<Notice tone="warning">Confirma que es quien dice.</Notice>);
    const notice = screen.getByRole("status");
    expect(notice.className).toContain("text-warning-text");
    expect(notice.className).not.toContain("danger");
  });

  it("una advertencia fija no se anuncia (announce=false) pero se sigue viendo", () => {
    render(<Notice tone="warning" announce={false}>Sin correo verificado.</Notice>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Sin correo verificado.")).toBeTruthy();
  });

  it("inline: sin recuadro, con el color del tono; size sm a 12 px", () => {
    render(<Notice tone="error" inline size="sm">No se ha podido guardar.</Notice>);
    const notice = screen.getByRole("alert");
    expect(notice.className).toContain("text-danger-text");
    expect(notice.className).not.toContain("rounded-card");
    expect(notice.className).toContain("text-xs");
  });

  it("as=div deja meter una lista dentro sin anidar bloques en texto", () => {
    const { container } = render(<Notice tone="warning" as="div" announce={false}><ul><li>Uno</li><li>Dos</li></ul></Notice>);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const list = container.querySelector("ul");
    // La lista va en un <div> dentro del <div> del aviso; ningún antepasado suyo es <span> ni <p>.
    expect(list.parentElement.tagName).toBe("DIV");
    expect(list.parentElement.parentElement.tagName).toBe("DIV");
    expect(list.closest("span, p")).toBeNull();
    // El icono sigue siendo el primer hijo y el contenido el segundo, como en los demás avisos.
    const notice = container.firstElementChild;
    expect([...notice.children].map((child) => child.tagName)).toEqual(["svg", "DIV"]);
  });

  it("con la etiqueta por defecto (p) el texto va en un <span>: HTML válido dentro de un párrafo", () => {
    const { container } = render(<Notice tone="error">No se ha podido guardar.</Notice>);
    const notice = container.firstElementChild;
    expect(notice.tagName).toBe("P");
    expect([...notice.children].map((child) => child.tagName)).toEqual(["svg", "SPAN"]);
    expect(notice.querySelector("div, ul, p")).toBeNull();
  });

  it("los cuatro tonos mantienen su icono, su rol y su clase con cualquiera de las dos etiquetas", () => {
    for (const as of ["p", "div"]) {
      const { container, unmount } = render(
        <>
          <Notice tone="error" as={as}>e</Notice>
          <Notice tone="warning" as={as}>w</Notice>
          <Notice tone="success" as={as}>s</Notice>
          <Notice tone="info" as={as}>i</Notice>
        </>,
      );
      const notices = [...container.children];
      expect(notices.map((notice) => notice.getAttribute("role"))).toEqual(["alert", "status", "status", "status"]);
      expect(notices.map((notice) => notice.tagName)).toEqual(Array(4).fill(as.toUpperCase()));
      expect(notices.every((notice) => notice.firstElementChild.tagName === "svg")).toBe(true);
      expect(notices[0].className).toContain("text-danger-text");
      expect(notices[1].className).toContain("text-warning-text");
      expect(notices[2].className).toContain("text-voy-text");
      expect(notices[3].className).toContain("text-ink");
      unmount();
    }
  });

  it("mantiene las clases de colocación que se le pasan (márgenes, centrado)", () => {
    render(<Notice tone="error" inline className="mt-2 justify-center text-center">Error</Notice>);
    expect(screen.getByRole("alert").className).toContain("mt-2");
  });

  it("EmptyState enseña su frase y su acción", () => {
    render(<EmptyState action={<button type="button">Añadir evento</button>}>No hay nada este mes.</EmptyState>);
    expect(screen.getByText("No hay nada este mes.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Añadir evento" })).toBeTruthy();
  });

  it("Badge usa el tono pedido", () => {
    render(<><Badge tone="club">Partido</Badge><Badge>Evento</Badge></>);
    expect(screen.getByText("Partido").className).toContain("bg-club");
    expect(screen.getByText("Evento").className).toContain("bg-raised");
  });
});
