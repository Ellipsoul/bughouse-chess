import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SharedGameDescription from "../../../app/components/shared/SharedGameDescription";

describe("SharedGameDescription", () => {
  it("renders a trimmed description", () => {
    render(<SharedGameDescription description="  Tactics galore  " />);

    const description = screen.getByTestId("shared-game-description");
    expect(description).toHaveTextContent("Tactics galore");
  });

  it("does not render when description is empty", () => {
    render(<SharedGameDescription description="   " />);

    expect(screen.queryByTestId("shared-game-description")).toBeNull();
  });

  it("supports compact density", () => {
    render(
      <SharedGameDescription description="Compact mode" density="compact" />,
    );

    const description = screen.getByTestId("shared-game-description");
    expect(description.className).toContain("text-[7px]");
  });
});
