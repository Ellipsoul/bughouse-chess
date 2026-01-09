import SharedGameCard from "../../app/components/SharedGameCard";
import type { SharedGame, SharedGameMetadata, SharedGameData } from "../../app/types/sharedGame";

/**
 * Creates mock metadata for a SharedGame.
 */
function createMockMetadata(overrides?: Partial<SharedGameMetadata>): SharedGameMetadata {
  return {
    gameCount: 1,
    result: "1 - 0",
    team1: {
      player1: { username: "Player1", chessTitle: "GM" },
      player2: { username: "Player2" },
    },
    team2: {
      player1: { username: "Player3", chessTitle: "FM" },
      player2: { username: "Player4" },
    },
    ...overrides,
  };
}

/**
 * Creates mock game data for a SharedGame.
 */
function createMockGameData(): SharedGameData {
  return {
    type: "game",
    game: {
      original: {} as never, // Full game data not needed for card tests
      partner: null,
      partnerId: null,
    },
  };
}

/**
 * Creates a mock SharedGame for testing.
 */
function createMockSharedGame(overrides?: Partial<SharedGame>): SharedGame {
  return {
    id: "test-shared-id",
    type: "game",
    sharerUserId: "sharer-user-id",
    sharerUsername: "TestSharer",
    description: "",
    sharedAt: new Date("2024-01-15T10:00:00Z"),
    gameDate: new Date("2024-01-14T20:00:00Z"),
    gameData: createMockGameData(),
    metadata: createMockMetadata(),
    ...overrides,
  };
}

/**
 * Component tests for SharedGameCard.
 *
 * NOTE: Tests that require stubbing sharedGamesService (ES module) are skipped
 * because Cypress cannot stub ES module exports. Delete functionality is
 * tested manually with the Firestore emulator.
 */
describe("SharedGameCard", () => {
  describe("Rendering", () => {
    it("renders card with game information", () => {
      const game = createMockSharedGame();

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("Game").should("be.visible");
      cy.contains("Player1").should("be.visible");
      cy.contains("Player2").should("be.visible");
      cy.contains("Player3").should("be.visible");
      cy.contains("Player4").should("be.visible");
      cy.contains("1 - 0").should("be.visible");
    });

    it("displays chess titles when present", () => {
      const game = createMockSharedGame();

      cy.mount(<SharedGameCard game={game} />);

      // ChessTitleBadge should render for GM and FM
      cy.contains("GM").should("be.visible");
      cy.contains("FM").should("be.visible");
    });

    it("displays sharer username", () => {
      const game = createMockSharedGame({ sharerUsername: "ChessKing123" });

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("Shared by:").should("be.visible");
      cy.contains("ChessKing123").should("be.visible");
    });

    it("displays description when present", () => {
      const game = createMockSharedGame({ description: "Amazing checkmate!" });

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("Amazing checkmate!").should("be.visible");
    });

    it("does not display description when empty", () => {
      const game = createMockSharedGame({ description: "" });

      cy.mount(<SharedGameCard game={game} />);

      cy.get(".italic").should("not.exist");
    });

    it("displays correct badge for match type", () => {
      const game = createMockSharedGame({ type: "match" });

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("Match").should("be.visible");
    });

    it("displays correct badge for partner games type", () => {
      const game = createMockSharedGame({ type: "partnerGames" });

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("Partner Games").should("be.visible");
    });

    it("displays game count for matches", () => {
      const game = createMockSharedGame({
        type: "match",
        metadata: createMockMetadata({ gameCount: 10 }),
      });

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("10 games").should("be.visible");
    });

    it("displays formatted date", () => {
      const game = createMockSharedGame({
        gameDate: new Date("2024-03-25T15:00:00Z"),
      });

      cy.mount(<SharedGameCard game={game} />);

      cy.contains("Mar 25, 2024").should("be.visible");
    });
  });

  describe("Delete Button Visibility", () => {
    it("does not show delete button when currentUserId is not provided", () => {
      const game = createMockSharedGame();

      cy.mount(<SharedGameCard game={game} />);

      cy.get('[aria-label="Delete shared game"]').should("not.exist");
    });

    it("does not show delete button when not owner", () => {
      const game = createMockSharedGame({ sharerUserId: "other-user" });

      cy.mount(<SharedGameCard game={game} currentUserId="current-user" />);

      cy.get('[aria-label="Delete shared game"]').should("not.exist");
    });

    it("shows delete button when owner (on hover)", () => {
      const game = createMockSharedGame({ sharerUserId: "current-user" });

      cy.mount(<SharedGameCard game={game} currentUserId="current-user" />);

      // The delete button has opacity-0 by default, but should exist in DOM
      cy.get('[aria-label="Delete shared game"]').should("exist");
      // Force hover state to verify visibility
      cy.get('[role="button"]').trigger("mouseenter");
      cy.get('[aria-label="Delete shared game"]').should("be.visible");
    });

    it("opens confirmation modal when delete button clicked", () => {
      const game = createMockSharedGame({ sharerUserId: "current-user" });

      cy.mount(<SharedGameCard game={game} currentUserId="current-user" />);

      cy.get('[aria-label="Delete shared game"]').click({ force: true });

      cy.get('[role="alertdialog"]').should("be.visible");
      cy.contains("Delete shared game?").should("be.visible");
    });

    it("closes modal when cancel is clicked", () => {
      const game = createMockSharedGame({ sharerUserId: "current-user" });

      cy.mount(<SharedGameCard game={game} currentUserId="current-user" />);

      cy.get('[aria-label="Delete shared game"]').click({ force: true });

      cy.get('[role="alertdialog"]').should("be.visible");
      cy.contains("button", "Cancel").click();
      cy.get('[role="alertdialog"]').should("not.exist");
    });
  });

  describe("Accessibility", () => {
    it("has correct aria-label", () => {
      const game = createMockSharedGame();

      cy.mount(<SharedGameCard game={game} />);

      cy.get('[role="button"]')
        .should("have.attr", "aria-label")
        .and("include", "View Game by TestSharer");
    });

    it("is keyboard accessible", () => {
      const game = createMockSharedGame();

      cy.mount(<SharedGameCard game={game} />);

      cy.get('[role="button"]').should("have.attr", "tabindex", "0");
    });
  });

  // NOTE: The following tests require stubbing sharedGamesService (ES module),
  // which is not supported by Cypress. Delete functionality is tested manually.
  //
  // Skipped tests:
  // - calls deleteSharedGame when deletion confirmed
  // - calls onDeleted callback after successful deletion
});
