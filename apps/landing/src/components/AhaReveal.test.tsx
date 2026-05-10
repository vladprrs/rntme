import "../test-setup";
import { render } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";
import { AhaReveal, revealSteps } from "./AhaReveal";

describe("AhaReveal", () => {
  it("renders the blueprint JSON block", () => {
    const { getByTestId } = render(<AhaReveal />);
    expect(getByTestId("blueprint-json")).toBeTruthy();
  });

  it("renders one panel per reveal step", () => {
    const { getByTestId } = render(<AhaReveal />);
    for (const step of revealSteps) {
      expect(getByTestId(`panel-${step.id}`)).toBeTruthy();
    }
  });

  it("each step starts hidden (data-visible=false)", () => {
    const { getByTestId } = render(<AhaReveal />);
    for (const step of revealSteps) {
      expect(getByTestId(`panel-${step.id}`).getAttribute("data-visible")).toBe("false");
    }
  });

  it("registers an IntersectionObserver per step", () => {
    const ObserverMock = mock(() => ({
      observe: mock(),
      unobserve: mock(),
      disconnect: mock(),
    }));
    globalThis.IntersectionObserver = ObserverMock as unknown as typeof IntersectionObserver;
    render(<AhaReveal />);
    expect(ObserverMock).toHaveBeenCalledTimes(revealSteps.length);
  });
});
