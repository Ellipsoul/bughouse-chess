import BughouseAnalysis from "../../app/components/viewer/BughouseAnalysis";
import type { ChessGame } from "../../app/actions";

import originalFixture from "../../tests/fixtures/chesscom/160064848971.json";
import partnerFixture from "../../tests/fixtures/chesscom/160064848973.json";

describe("BughouseAnalysis live replay controls", () => {
  const original = originalFixture as unknown as ChessGame;
  const partner = partnerFixture as unknown as ChessGame;

  it("hides Stop, enables prev/next seek during playback, and keeps jump-to-start/end disabled", () => {
    cy.mount(
      <div className="h-[900px] w-[1400px] bg-gray-900">
        <BughouseAnalysis
          gameData={{ original, partner }}
          isLoading={false}
          showGamesLoadedInline={false}
        />
      </div>,
    );

    // Prevent the RAF loop from running so the test is deterministic while still allowing
    // live replay to enter the "playing" state.
    cy.window().then((win) => {
      cy.stub(win, "requestAnimationFrame").callsFake(() => 1);
      cy.stub(win, "cancelAnimationFrame").callsFake(() => {});
    });

    // Stop button should not exist anymore.
    cy.get('[aria-label="Stop live replay"]').should("not.exist");

    // Start playback.
    cy.get('[aria-label="Play live replay"]').click();
    cy.get('[aria-label="Pause live replay"]').should("exist");

    // While playing: jump-to-start/end remain disabled.
    cy.get('[aria-label="Jump to start"]').should("be.disabled");
    cy.get('[aria-label="Jump to end"]').should("be.disabled");

    // Next move should be enabled (even while playing) at game start.
    cy.get('[aria-label="Next move"]').should("not.be.disabled");

    // Seek forward via keyboard; this should move the cursor so previous becomes enabled.
    cy.window().then((win) => {
      win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    cy.get('[aria-label="Previous move"]').should("not.be.disabled");
  });
});
