/**
 * Cypress component tests for {@link BughouseAnalysis} fullscreen affordance.
 *
 * Stubs `matchMedia` and the Fullscreen API to assert desktop-only fullscreen
 * entry/exit without a real browser chrome session.
 */
import BughouseAnalysis from "../../app/components/viewer/BughouseAnalysis";
import {
  ViewerOrientationStore,
  ViewerOrientationStoreProvider,
} from "../../app/stores/viewerOrientationStore";

const DESKTOP_FULLSCREEN_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Patches `window.matchMedia` and Fullscreen API on the AUT window so tests can
 * force desktop pointer/hover eligibility and track fullscreen requests.
 */
function installFullscreenMock(win: Cypress.AUTWindow, desktopPointer: boolean) {
  const nativeMatchMedia = win.matchMedia.bind(win);

  cy.stub(win, "matchMedia").callsFake((query: string) => {
    if (query !== DESKTOP_FULLSCREEN_MEDIA_QUERY) {
      return nativeMatchMedia(query);
    }

    return {
      matches: desktopPointer,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    } as MediaQueryList;
  });

  const fullscreenState: { element: Element | null } = { element: null };
  Object.defineProperty(win.document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(win.document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenState.element,
  });
  Object.defineProperty(win.HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    value(this: HTMLElement) {
      fullscreenState.element = this;
      win.document.dispatchEvent(new win.Event("fullscreenchange"));
      return Promise.resolve();
    },
  });
  Object.defineProperty(win.document, "exitFullscreen", {
    configurable: true,
    value() {
      fullscreenState.element = null;
      win.document.dispatchEvent(new win.Event("fullscreenchange"));
      return Promise.resolve();
    },
  });
}

/** Sized wrapper mounting {@link BughouseAnalysis} for fullscreen layout tests. */
function AnalysisFixture({ height, width }: { height: number; width: number }) {
  const orientationStore = new ViewerOrientationStore(0);

  return (
    <div className="bg-gray-900" style={{ height, width }}>
      <ViewerOrientationStoreProvider store={orientationStore}>
        <BughouseAnalysis isLoading={false} showGamesLoadedInline={false} />
      </ViewerOrientationStoreProvider>
    </div>
  );
}

describe("BughouseAnalysis fullscreen", () => {
  it("fills a desktop viewport with the boards and removes the move list", () => {
    cy.viewport(1600, 1000);
    cy.window().then((win) => {
      installFullscreenMock(win, true);
      cy.mount(<AnalysisFixture height={1000} width={1600} />);
    });

    cy.get("[data-testid='analysis-fullscreen-toggle']")
      .should("have.attr", "aria-label", "Enter full screen")
      .and("have.attr", "aria-pressed", "false");
    cy.get("[data-testid='analysis-move-list-panel']").should("exist");

    // Component tests mock the Fullscreen API rather than granting a real fullscreen viewport.
    // Supply the geometry the browser would give the fullscreen panel so board maximization is
    // still exercised deterministically.
    cy.get("[data-testid='analysis-board-panel']").then(($panel) => {
      Object.defineProperty($panel[0], "clientHeight", { configurable: true, value: 1000 });
    });
    cy.get("[data-testid='boards-container']").then(($boards) => {
      Object.defineProperty($boards[0], "clientWidth", { configurable: true, value: 1600 });
    });
    cy.get("[data-testid='analysis-controls']").then(($controls) => {
      Object.defineProperty($controls[0], "clientHeight", { configurable: true, value: 40 });
    });

    cy.get("[data-testid='analysis-fullscreen-toggle']").click();

    cy.get("[data-testid='analysis-board-panel']")
      .should("have.attr", "data-fullscreen", "true");
    cy.get("[data-testid='analysis-fullscreen-toggle']")
      .should("have.attr", "aria-label", "Exit full screen")
      .and("have.attr", "aria-pressed", "true");
    cy.get("[data-testid='analysis-move-list-panel']").should("not.exist");
    cy.get("[data-testid='boards-container']").should(($boards) => {
      expect($boards.height()).to.be.greaterThan(512);
    });

    cy.get("[data-testid='analysis-fullscreen-toggle']").click();
    cy.get("[data-testid='analysis-board-panel']")
      .should("have.attr", "data-fullscreen", "false");
    cy.get("[data-testid='analysis-move-list-panel']").should("exist");
  });

  it("does not expose fullscreen on mobile input devices", () => {
    cy.viewport(390, 844);
    cy.window().then((win) => {
      installFullscreenMock(win, false);
      cy.mount(<AnalysisFixture height={844} width={390} />);
    });

    cy.get("[data-testid='analysis-fullscreen-toggle']").should("not.exist");
    cy.get("[data-testid='analysis-move-list-panel']").should("exist");
  });
});
