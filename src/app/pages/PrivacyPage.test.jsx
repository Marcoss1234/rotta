import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage, { SECTIONS, sectionId } from "./PrivacyPage.jsx";

describe("PrivacyPage", () => {
  it("cada apartado del índice existe, con su título, y el enlace lleva a él", () => {
    render(<PrivacyPage />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(SECTIONS);
    for (const title of SECTIONS) {
      expect(document.getElementById(sectionId(title))).toBeTruthy();
      expect(screen.getByRole("link", { name: title }).getAttribute("href")).toBe(`#${sectionId(title)}`);
    }
  });

  it("vuelve a la app y enlaza a la AEPD", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: /Volver a la app/ }).getAttribute("href")).toBe("/app");
    expect(screen.getByRole("link", { name: "www.aepd.es" }).getAttribute("href")).toBe("https://www.aepd.es");
    expect(sectionId("Menores de 14 años")).toBe("menores-de-14-anos");
  });
});
