import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { InteractiveDotField } from "../components/interactive-dot-field";

describe("InteractiveDotField", () => {
  it("renders six animated lanes and twelve reduced-motion terms", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(createElement(InteractiveDotField));

    expect(container.querySelectorAll(".interactive-dot-field__lane")).toHaveLength(6);
    expect(container.querySelectorAll(".interactive-dot-field__track")).toHaveLength(6);
    expect(container.querySelectorAll(".interactive-dot-field__sequence--repeat")).toHaveLength(6);
    expect(container.querySelectorAll("[data-static-term]")).toHaveLength(12);
    expect(container.querySelectorAll('[data-static-align="start"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-static-align="end"]')).toHaveLength(4);
  });
});
