import MatchNavigation from "../../app/components/match/MatchNavigation";
import type { MatchGame, PartnerPair } from "../../app/types/match";
import type { ChessGame } from "../../app/actions";

/**
 * Creates a mock ChessGame for testing.
 */
function createMockChessGame(
  id: number,
  white: string,
  black: string,
  result: "1-0" | "0-1" | "1/2-1/2",
): ChessGame {
  return {
    game: {
      id,
      uuid: `uuid-${id}`,
      moveList: "",
      type: "bughouse",
      typeName: "Bughouse",
      partnerGameId: id + 1,
      plyCount: 0,
      isFinished: true,
      isRated: true,
      turnColor: "white",
      pgnHeaders: {
        Event: "Test",
        Site: "Test",
        Date: "2025.01.01",
        White: white,
        Black: black,
        Result: result,
        WhiteElo: 2000,
        BlackElo: 2000,
        TimeControl: "180",
      },
      baseTime1: 1800,
      timeIncrement1: 0,
      endTime: Date.now() / 1000,
    },
    players: {
      top: { id: 1, username: black, rating: 2000, color: "black" },
      bottom: { id: 2, username: white, rating: 2000, color: "white" },
    },
  };
}

/**
 * Creates mock match games for testing dropdown.
 */
function createMockMatchGames(count: number): MatchGame[] {
  const games: MatchGame[] = [];
  const results: Array<"1-0" | "0-1" | "1/2-1/2"> = ["1-0", "0-1", "1/2-1/2"];

  for (let i = 0; i < count; i++) {
    const gameId = 160000000000 + i * 2;
    const result = results[i % 3];

    games.push({
      gameId: gameId.toString(),
      partnerGameId: (gameId + 1).toString(),
      original: createMockChessGame(gameId, `PlayerA${i}`, `PlayerB${i}`, result),
      partner: createMockChessGame(gameId + 1, `PlayerC${i}`, `PlayerD${i}`, result === "1-0" ? "0-1" : "1-0"),
      endTime: Date.now() / 1000 + i * 300,
    });
  }

  return games;
}

/**
 * Creates mock match games with fixed teams across all games.
 * This keeps score expectations deterministic for summary assertions.
 */
function createConsistentTeamMatchGames(
  results: Array<"1-0" | "0-1" | "1/2-1/2">,
): MatchGame[] {
  const games: MatchGame[] = [];
  const team1BoardA = "Team1BoardA";
  const team1BoardB = "Team1BoardB";
  const team2BoardA = "Team2BoardA";
  const team2BoardB = "Team2BoardB";

  for (let i = 0; i < results.length; i++) {
    const gameId = 170000000000 + i * 2;
    const result = results[i];

    games.push({
      gameId: gameId.toString(),
      partnerGameId: (gameId + 1).toString(),
      original: createMockChessGame(gameId, team1BoardA, team2BoardA, result),
      partner: createMockChessGame(gameId + 1, team2BoardB, team1BoardB, result),
      endTime: Date.now() / 1000 + i * 300,
    });
  }

  return games;
}

describe("MatchNavigation", () => {
  describe("idle state with no game loaded", () => {
    it("renders Find Match Games button disabled when no game loaded", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={false}
          discoveryStatus="idle"
          totalGames={0}
          currentIndex={0}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.contains("Find Match").should("exist");
      cy.contains("Find Match").should("be.disabled");
    });
  });

  describe("idle state with game loaded", () => {
    it("renders Find Match Games button enabled when game is loaded", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="idle"
          totalGames={0}
          currentIndex={0}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.contains("Find Match").should("exist");
      cy.contains("Find Match").should("not.be.disabled");
    });

    it("calls onFindMatchGames when button is clicked", () => {
      const onFindMatchGames = cy.stub().as("onFindMatchGames");
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="idle"
          totalGames={0}
          currentIndex={0}
          onFindMatchGames={onFindMatchGames}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.contains("Find Match").click();
      cy.get("@onFindMatchGames").should("have.been.calledOnce");
    });
  });

  describe("discovering state", () => {
    it("shows loading indicator during discovery", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="discovering"
          totalGames={1}
          currentIndex={0}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      // Should show loading text
      cy.contains(/Finding games|Searching/).should("exist");
    });

    it("disables navigation buttons during discovery", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="discovering"
          totalGames={3}
          currentIndex={1}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      // Both prev/next buttons should be disabled
      cy.get('button[aria-label="Previous game"]').should("be.disabled");
      cy.get('button[aria-label="Next game"]').should("be.disabled");
    });
  });

  describe("complete state with match games", () => {
    it("shows game counter when match has multiple games", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.contains("Game 3 of 5").should("exist");
    });

    it("enables previous button when not on first game", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.get('button[aria-label="Previous game"]').should("not.be.disabled");
    });

    it("disables previous button on first game", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={0}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.get('button[aria-label="Previous game"]').should("be.disabled");
    });

    it("enables next button when not on last game", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.get('button[aria-label="Next game"]').should("not.be.disabled");
    });

    it("disables next button on last game", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={4}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.get('button[aria-label="Next game"]').should("be.disabled");
    });

    it("calls onPreviousGame when previous button is clicked", () => {
      const onPreviousGame = cy.stub().as("onPreviousGame");
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          onFindMatchGames={cy.stub()}
          onPreviousGame={onPreviousGame}
          onNextGame={cy.stub()}
        />,
      );

      cy.get('button[aria-label="Previous game"]').click();
      cy.get("@onPreviousGame").should("have.been.calledOnce");
    });

    it("calls onNextGame when next button is clicked", () => {
      const onNextGame = cy.stub().as("onNextGame");
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={onNextGame}
        />,
      );

      cy.get('button[aria-label="Next game"]').click();
      cy.get("@onNextGame").should("have.been.calledOnce");
    });
  });

  describe("error state", () => {
    it("shows retry button in error state", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="error"
          totalGames={0}
          currentIndex={0}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.contains("Retry").should("exist");
    });

    it("calls onFindMatchGames when retry is clicked", () => {
      const onFindMatchGames = cy.stub().as("onFindMatchGames");
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="error"
          totalGames={0}
          currentIndex={0}
          onFindMatchGames={onFindMatchGames}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
        />,
      );

      cy.contains("Retry").click();
      cy.get("@onFindMatchGames").should("have.been.calledOnce");
    });
  });

  describe("pending state", () => {
    it("disables all buttons when isPending is true", () => {
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          isPending={true}
        />,
      );

      cy.get('button[aria-label="Previous game"]').should("be.disabled");
      cy.get('button[aria-label="Next game"]').should("be.disabled");
    });
  });

  describe("game dropdown", () => {
    it("shows dropdown when game counter is clicked", () => {
      const mockGames = createMockMatchGames(5);
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      // Click on the game counter to open dropdown
      cy.contains("Game 3 of 5").click();

      // Dropdown should be visible with all games
      cy.get('[role="listbox"]').should("exist");
      cy.get('[role="option"]').should("have.length", 5);
    });

    it("highlights current game in dropdown", () => {
      const mockGames = createMockMatchGames(5);
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      cy.contains("Game 3 of 5").click();

      // Third item (index 2) should be highlighted
      cy.get('[role="option"][aria-selected="true"]').should("exist");
      cy.get('[role="option"][aria-selected="true"]').should("contain", "#3");
    });

    it("calls onSelectGame when a game is selected from dropdown", () => {
      const mockGames = createMockMatchGames(5);
      const onSelectGame = cy.stub().as("onSelectGame");

      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={onSelectGame}
        />,
      );

      // Open dropdown
      cy.contains("Game 3 of 5").click();

      // Click on game #1 (index 0)
      cy.get('[role="option"]').first().click();

      cy.get("@onSelectGame").should("have.been.calledWith", 0);
    });

    it("closes dropdown when a game is selected", () => {
      const mockGames = createMockMatchGames(5);
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={5}
          currentIndex={2}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      // Open dropdown
      cy.contains("Game 3 of 5").click();
      cy.get('[role="listbox"]').should("exist");

      // Select a game
      cy.get('[role="option"]').first().click();

      // Dropdown should be closed
      cy.get('[role="listbox"]').should("not.exist");
    });

    it("displays player names in dropdown items", () => {
      const mockGames = createMockMatchGames(3);
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={3}
          currentIndex={0}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      cy.contains("Game 1 of 3").click();

      // First game should show player names
      cy.get('[role="option"]').first().should("contain", "PlayerA0");
      cy.get('[role="option"]').first().should("contain", "PlayerB0");
    });

    it("shows correct result colors", () => {
      const mockGames = createMockMatchGames(3);
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={3}
          currentIndex={0}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      cy.contains("Game 1 of 3").click();

      // Results should be displayed
      cy.get('[role="option"]').first().should("contain", "1-0");
    });

    it("shows current and final score in full match mode", () => {
      const mockGames = createConsistentTeamMatchGames(["1-0", "0-1", "1/2-1/2", "1-0"]);
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={4}
          currentIndex={3}
          matchGames={mockGames}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      cy.contains("Game 4 of 4").click();

      cy.get('[data-testid="match-score-summary"]').should("exist");
      cy.get('[data-testid="current-score-row"]')
        .should("contain", "Current")
        .and("contain", "1-1")
        .and("contain", "(1 draw)");
      cy.get('[data-testid="final-score-row"]')
        .should("contain", "Final")
        .and("contain", "2-1")
        .and("contain", "(1 draw)");
      cy.get('[data-testid="match-score-summary"]').should("contain", "(1 draw)");
    });

    it("shows current and final score in partner pair mode", () => {
      const mockGames = createConsistentTeamMatchGames(["1-0", "0-1", "1/2-1/2", "1-0"]);
      const selectedPair: PartnerPair = {
        usernames: ["team1boarda", "team1boardb"],
        displayNames: ["Team1BoardA", "Team1BoardB"],
      };
      cy.mount(
        <MatchNavigation
          hasGameLoaded={true}
          discoveryStatus="complete"
          totalGames={4}
          currentIndex={3}
          matchGames={mockGames}
          selectedPair={selectedPair}
          onFindMatchGames={cy.stub()}
          onPreviousGame={cy.stub()}
          onNextGame={cy.stub()}
          onSelectGame={cy.stub()}
        />,
      );

      cy.contains("Game 4 of 4").click();

      cy.get('[data-testid="partner-pair-score-summary"]').should("exist");
      cy.get('[data-testid="current-score-row"]')
        .should("contain", "Current")
        .and("contain", "1-1")
        .and("contain", "(1 draw)");
      cy.get('[data-testid="final-score-row"]')
        .should("contain", "Final")
        .and("contain", "2-1")
        .and("contain", "(1 draw)");
      cy.get('[data-testid="partner-pair-score-summary"]').should("contain", "(1 draw)");
    });
  });
});
