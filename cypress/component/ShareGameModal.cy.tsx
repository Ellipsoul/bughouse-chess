import ShareGameModal from "../../app/components/ShareGameModal";
import type { SingleGameData } from "../../app/types/sharedGame";
import type { ChessGame } from "../../app/actions";

/**
 * Creates a minimal mock ChessGame for testing.
 */
function createMockChessGame(overrides?: {
  white?: string;
  black?: string;
  colorOfWinner?: string;
}): ChessGame {
  return {
    game: {
      id: 123456789012,
      uuid: "test-uuid",
      moveList: "e2e4",
      type: "bughouse",
      typeName: "Bughouse",
      plyCount: 1,
      isFinished: true,
      isRated: true,
      colorOfWinner: overrides?.colorOfWinner ?? "white",
      turnColor: "black",
      pgnHeaders: {
        Event: "Live Chess",
        Site: "Chess.com",
        Date: "2024.01.15",
        White: overrides?.white ?? "Player1",
        Black: overrides?.black ?? "Player2",
        Result: "1-0",
        WhiteElo: 1500,
        BlackElo: 1500,
        TimeControl: "180",
      },
      baseTime1: 180,
      timeIncrement1: 0,
    },
    players: {
      top: {
        id: 1,
        username: overrides?.black ?? "Player2",
        rating: 1500,
        color: "black",
      },
      bottom: {
        id: 2,
        username: overrides?.white ?? "Player1",
        rating: 1500,
        color: "white",
      },
    },
  };
}

/**
 * Creates mock single game data for testing.
 */
function createMockSingleGameData(): SingleGameData {
  return {
    original: createMockChessGame({ white: "TestWhite", black: "TestBlack" }),
    partner: createMockChessGame({ white: "PartnerWhite", black: "PartnerBlack" }),
    partnerId: "987654321098",
  };
}

/**
 * Component tests for ShareGameModal.
 *
 * NOTE: Tests that require stubbing sharedGamesService (ES module) are skipped
 * because Cypress cannot stub ES module exports. Sharing functionality is
 * tested manually with the Firestore emulator.
 */
describe("ShareGameModal", () => {
  describe("Rendering", () => {
    it("does not render when closed", () => {
      cy.mount(
        <ShareGameModal
          open={false}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      cy.get('[role="dialog"]').should("not.exist");
    });

    it("renders modal when open", () => {
      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      cy.get('[role="dialog"]').should("be.visible");
      cy.contains("Share Game").should("be.visible");
    });

    it("displays game summary with players", () => {
      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      cy.contains("TestWhite").should("be.visible");
      cy.contains("TestBlack").should("be.visible");
      cy.contains("PartnerWhite").should("be.visible");
      cy.contains("PartnerBlack").should("be.visible");
    });

    it("displays sharer username", () => {
      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      cy.contains("Sharing as").should("be.visible");
      cy.contains("testuser").should("be.visible");
    });

    it("displays correct content type label for match", () => {
      const mockGame = createMockChessGame();
      const matchGames = [
        {
          gameId: "123",
          partnerGameId: "456",
          original: mockGame,
          partner: mockGame,
          endTime: Date.now(),
        },
      ];

      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          matchGames={matchGames}
          contentType="match"
          onClose={() => {}}
        />,
      );

      cy.contains("Share Match").should("be.visible");
    });
  });

  describe("Description Input", () => {
    it("shows character count", () => {
      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      cy.contains("100 characters remaining").should("be.visible");
    });

    it("updates character count as user types", () => {
      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      cy.get("#share-description").type("Test description");
      cy.contains("84 characters remaining").should("be.visible");
    });

    it("enforces character limit", () => {
      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={() => {}}
        />,
      );

      const longText = "a".repeat(150);
      cy.get("#share-description").type(longText);
      cy.get("#share-description").should("have.value", "a".repeat(100));
      cy.contains("0 characters remaining").should("be.visible");
    });
  });

  describe("Actions", () => {
    it("calls onClose when cancel button is clicked", () => {
      const onClose = cy.stub().as("onClose");

      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={onClose}
        />,
      );

      cy.contains("button", "Cancel").click();
      cy.get("@onClose").should("have.been.calledOnce");
    });

    it("calls onClose when backdrop is clicked", () => {
      const onClose = cy.stub().as("onClose");

      cy.mount(
        <ShareGameModal
          open={true}
          userId="test-user"
          username="testuser"
          singleGameData={createMockSingleGameData()}
          contentType="game"
          onClose={onClose}
        />,
      );

      cy.get('[aria-label="Close dialog"]').click({ force: true });
      cy.get("@onClose").should("have.been.calledOnce");
    });

    // NOTE: The following tests require stubbing sharedGamesService (ES module),
    // which is not supported by Cypress. Share functionality is tested manually.
    //
    // Skipped tests:
    // - calls shareGame service when share button is clicked
    // - shows loading state while sharing
    // - closes on escape key (flaky in Cypress)
  });
});
