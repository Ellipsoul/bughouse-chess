import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ChessGame } from "@/app/actions";
import type { MatchGame } from "@/app/types/match";
import original from "../../fixtures/chesscom/161531824441.json";
import partner from "../../fixtures/chesscom/161531824439.json";
import { computeGameMaterial } from "@/app/utils/match/matchMaterial";
import { BughouseReplayController } from "@/app/utils/replay/replayController";
import { processGameData } from "@/app/utils/board/moveOrdering";
import MatchNavigation from "@/app/components/match/MatchNavigation";

const game: MatchGame = { gameId: String(original.game.id), partnerGameId: String(partner.game.id), original: original as ChessGame, partner: partner as ChessGame, endTime: 0 };

describe("match material", () => {
  it("matches the final replay ledger for a recorded game on both boards", () => {
    const controller = new BughouseReplayController(processGameData(game.original, game.partner));
    while (controller.canMoveForward()) expect(controller.moveForward()).toBe(true);
    const totals = computeGameMaterial(game, "bughouse");
    expect(totals).not.toBeNull();
    for (const [board, source] of [["A", game.original], ["B", game.partner]] as const) {
      expect(totals?.[source.game.pgnHeaders.White.toLowerCase()]).toBe(controller.getCurrentGameState().captureMaterial[board].white);
      expect(totals?.[source.game.pgnHeaders.Black.toLowerCase()]).toBe(controller.getCurrentGameState().captureMaterial[board].black);
    }
    expect(Object.values(totals!).reduce((a, b) => a + b, 0)).toBe(0);
    expect(computeGameMaterial(game, "standard")).not.toEqual(totals);
  });

  it("attributes balances by username when boards swap and name casing changes", () => {
    const swapped = structuredClone(game);
    [swapped.original, swapped.partner] = [swapped.partner, swapped.original];
    swapped.original.game.pgnHeaders.White = swapped.original.game.pgnHeaders.White.toUpperCase();
    expect(computeGameMaterial(swapped, "bughouse")).toEqual(computeGameMaterial(game, "bughouse"));
  });

  it("does not report partial data as a total", () => {
    const broken = structuredClone(game);
    broken.original.game.moveTimestamps = "1";
    expect(computeGameMaterial(broken, "bughouse")).toBeNull();
  });

  it("keeps full-match totals fixed when the selected game changes and hides them for a single game", async () => {
    const games = [game, { ...game, gameId: "second" }];
    const props = { hasGameLoaded: true, discoveryStatus: "complete" as const, totalGames: 2, currentIndex: 0, matchGames: games, onFindMatchGames() {}, onPreviousGame() {}, onNextGame() {} };
    const { rerender } = render(<MatchNavigation {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Select game from match" }));
    await waitFor(() => expect(within(screen.getByTestId("match-material-summary")).getAllByText("Team total")).toHaveLength(2));
    const text = screen.getByTestId("match-material-summary").textContent;
    rerender(<MatchNavigation {...props} currentIndex={1} />);
    expect(screen.getByTestId("match-material-summary").textContent).toBe(text);
    rerender(<MatchNavigation {...props} totalGames={1} matchGames={[game]} />);
    expect(screen.queryByTestId("match-material-summary")).toBeNull();
  });
});
