import { useMemo, useState } from "react";
import BughouseAnalysis from "../../app/components/viewer/BughouseAnalysis";
import {
  ViewerOrientationStore,
  ViewerOrientationStoreProvider,
} from "../../app/stores/viewerOrientationStore";
import type { ChessGame } from "../../app/actions";

import originalFixture from "../../tests/fixtures/chesscom/160064848971.json";
import partnerFixture from "../../tests/fixtures/chesscom/160064848973.json";

describe("BughouseAnalysis board order", () => {
  const original = originalFixture as unknown as ChessGame;
  const partner = partnerFixture as unknown as ChessGame;

  const Wrapper = () => {
    const [gameKey, setGameKey] = useState("game-1");
    const [boardsFlipped, setBoardsFlipped] = useState(false);
    const orientationStore = useMemo(() => new ViewerOrientationStore(0), []);

    return (
      <ViewerOrientationStoreProvider store={orientationStore}>
        <button
          type="button"
          data-testid="next-game"
          onClick={() => setGameKey((prev) => (prev === "game-1" ? "game-2" : "game-1"))}
        >
          Next game
        </button>
        <BughouseAnalysis
          key={gameKey}
          gameData={{ original, partner }}
          boardsFlipped={boardsFlipped}
          onBoardsFlippedChange={setBoardsFlipped}
          isLoading={false}
          showGamesLoadedInline={false}
        />
      </ViewerOrientationStoreProvider>
    );
  };

  it("preserves swapped order across flips and match navigation", () => {
    cy.mount(
      <div className="h-[900px] w-[1400px] bg-gray-900">
        <Wrapper />
      </div>,
    );

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "A");

    cy.get("[data-testid='swap-board-order']").click();

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "B");

    cy.get('[aria-label="Flip boards"]').click();

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "B");

    cy.get("[data-testid='next-game']").click();

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "B");
  });

  it("toggles board order with 's' key", () => {
    cy.mount(
      <div className="h-[900px] w-[1400px] bg-gray-900">
        <Wrapper />
      </div>,
    );

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "A");

    cy.window().then((win) => {
      win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "s" }));
    });

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "B");

    cy.window().then((win) => {
      win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "s" }));
    });

    cy.get("[data-testid='boards-container'] [data-role='board-column']")
      .eq(0)
      .should("have.attr", "data-board-id", "A");
  });
});
