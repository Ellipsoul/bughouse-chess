import "../../app/globals.css";
import BughouseAnalysis from "../../app/components/viewer/BughouseAnalysis";
import { ViewerOrientationStore, ViewerOrientationStoreProvider } from "../../app/stores/viewerOrientationStore";
import type { ChessGame } from "../../app/actions";
import originalFixture from "../../tests/fixtures/chesscom/160064848971.json";
import partnerFixture from "../../tests/fixtures/chesscom/160064848973.json";

function mountViewer() {
  const original = structuredClone(originalFixture);
  original.players.top.username = "AReallyLongPlayerUsername";
  original.game.pgnHeaders.Black = "AReallyLongPlayerUsername";
  cy.mount(
    <div style={{ height: "calc(100dvh - 80px)", width: "calc(100vw - 80px)" }}>
      <ViewerOrientationStoreProvider store={new ViewerOrientationStore(0)}>
        <BughouseAnalysis gameData={{ original: original as unknown as ChessGame, partner: partnerFixture as unknown as ChessGame }} />
      </ViewerOrientationStoreProvider>
    </div>,
  );
}

function assertNoHorizontalOverflow() {
  cy.get(".bh-analysis, .bh-controls").should($elements => {
    for (const element of $elements.toArray()) {
      expect(element.scrollWidth, `${element.className} overflow`).to.be.at.most(element.clientWidth + 1);
    }
  });
  cy.get(".bh-player-bar").should($bars => {
    for (const element of $bars.toArray()) {
      const bar = element.getBoundingClientRect();
      const clock = element.querySelector(".bh-player-clock")!.getBoundingClientRect();
      const identity = element.querySelector(".bh-player-identity")!.getBoundingClientRect();
      expect(identity.right).to.be.at.most(clock.left + 1);
      expect(clock.right).to.be.at.most(bar.right + 1);
      expect(element.querySelectorAll("[aria-label^='Chess title:']")).to.have.length(1);
      expect(element.querySelectorAll(".bh-player-rating")).to.have.length(1);
      const material = element.querySelector("[aria-label^='Capture material']")!.getBoundingClientRect();
      for (const label of element.querySelectorAll(".bh-player-name, .bh-player-rating, .bh-player-clock, [aria-label^='Chess title:']")) {
        const rect = label.getBoundingClientRect();
        const intersects = rect.left < material.right && rect.right > material.left
          && rect.top < material.bottom && rect.bottom > material.top;
        expect(intersects, `${label.textContent} overlaps material`).to.equal(false);
        expect(rect.top, `${label.textContent} above player bar`).to.be.at.least(bar.top - 1);
        expect(rect.bottom, `${label.textContent} below player bar`).to.be.at.most(bar.bottom + 1);
      }
    }
  });
}

describe("Analysis responsive geometry", () => {
  it("uses desktop space beyond the old cap and aligns the move list", () => {
    cy.viewport(1600, 1000);
    mountViewer();
    cy.get('[data-role="board-column"]').first().should($board => {
      expect($board.width()).to.be.greaterThan(400);
    });
    cy.get(".bh-move-panel").should($list => {
      const list = $list[0].getBoundingClientRect();
      const boards = $list[0].parentElement!.querySelector(".bh-boards")!.getBoundingClientRect();
      expect(Math.abs(list.top - boards.top)).to.be.lessThan(2);
      expect(list.left).to.be.greaterThan(boards.right);
    });
    assertNoHorizontalOverflow();
  });

  for (const [width, height] of [[834, 1194], [390, 844], [320, 740], [844, 390], [667, 375], [568, 320]]) {
    it(`preserves metadata and playable bounds at ${width} x ${height}`, () => {
      cy.viewport(width, height);
      mountViewer();
      cy.get(".bh-player-rating").should("have.length", 4);
      cy.get(".bh-player-name").first().should("have.attr", "title", "AReallyLongPlayerUsername");
      assertNoHorizontalOverflow();
      cy.get('[data-role="board-column"]').should($boards => {
        const first = $boards[0].getBoundingClientRect();
        const second = $boards[1].getBoundingClientRect();
        if (width < 620 && height > width) expect(second.top).to.be.greaterThan(first.bottom);
        else expect(second.top).to.equal(first.top);
      });
      if (height <= 500) {
        cy.get('.bh-controls button').should($buttons => {
          for (const button of $buttons.toArray()) {
            const rect = button.getBoundingClientRect();
            expect(rect.width).to.equal(32);
            expect(rect.height).to.equal(32);
          }
        });
        if (width === 844 && height === 390) {
          // Previously 166px here: smaller controls and their gap recover 12px for each board.
          cy.get('[data-role="board-column"]').first().should($board => {
            expect($board.width()).to.be.at.least(178);
          });
        }
        cy.get(".bh-controls").should($controls => {
          const viewport = $controls[0].closest(".bh-analysis")!.getBoundingClientRect();
          expect($controls[0].getBoundingClientRect().bottom).to.be.at.most(viewport.bottom + 1);
        });
      }
      cy.get('[aria-label="Next move"]').click();
      cy.get('[aria-label="Previous move"]').should("be.enabled");
      cy.get('[aria-label="Jump to end"]').click();
      assertNoHorizontalOverflow();
      cy.get('[aria-label="Flip boards"]').click();
      assertNoHorizontalOverflow();
    });
  }

  it("reflows on resize without losing the current move", () => {
    cy.viewport(1600, 1000);
    mountViewer();
    cy.get('[aria-label="Next move"]').click();
    cy.viewport(390, 844);
    assertNoHorizontalOverflow();
    cy.get('[aria-label="Previous move"]').should("be.enabled");
    cy.viewport(1600, 1000);
    cy.get('[data-role="board-column"]').first().should($board => expect($board.width()).to.be.greaterThan(400));
    cy.get('[aria-label="Previous move"]').should("be.enabled");
  });
});
