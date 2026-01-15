import { describe, expect, it } from "vitest";
import type { ChessGame } from "../../../app/actions";
import type { MatchGame, PartnerPair } from "../../../app/types/match";
import type { SingleGameData } from "../../../app/types/sharedGame";
import {
  computeShareContentHash,
  createShareHashInputFromMatchGames,
  createShareHashInputFromSingleGame,
} from "../../../app/utils/sharedGameHash";

function createChessGame(id: string): ChessGame {
  return {
    game: {
      id,
      pgnHeaders: {
        White: "PlayerA",
        Black: "PlayerB",
      },
    },
  } as unknown as ChessGame;
}

function createMatchGame(gameId: string, partnerGameId: string): MatchGame {
  return {
    gameId,
    partnerGameId,
    original: createChessGame(gameId),
    partner: createChessGame(partnerGameId),
    endTime: 1,
  };
}

describe("sharedGameHash", () => {
  it("is order-invariant for match game lists", () => {
    const userId = "user-123";
    const gameA = createMatchGame("1001", "2001");
    const gameB = createMatchGame("1002", "2002");

    const firstHash = computeShareContentHash(
      createShareHashInputFromMatchGames({
        userId,
        contentType: "match",
        matchGames: [gameA, gameB],
      }),
    );
    const secondHash = computeShareContentHash(
      createShareHashInputFromMatchGames({
        userId,
        contentType: "match",
        matchGames: [gameB, gameA],
      }),
    );

    expect(firstHash).toBe(secondHash);
  });

  it("distinguishes match shares from partner series shares", () => {
    const userId = "user-123";
    const gameA = createMatchGame("1001", "2001");
    const gameB = createMatchGame("1002", "2002");
    const selectedPair: PartnerPair = {
      usernames: ["alice", "bob"],
      displayNames: ["Alice", "Bob"],
    };

    const matchHash = computeShareContentHash(
      createShareHashInputFromMatchGames({
        userId,
        contentType: "match",
        matchGames: [gameA, gameB],
      }),
    );
    const partnerHash = computeShareContentHash(
      createShareHashInputFromMatchGames({
        userId,
        contentType: "partnerGames",
        matchGames: [gameA, gameB],
        selectedPair,
      }),
    );

    expect(matchHash).not.toBe(partnerHash);
  });

  it("changes when the user or game changes", () => {
    const gameData: SingleGameData = {
      original: createChessGame("3001"),
      partner: createChessGame("4001"),
      partnerId: "4001",
    };

    const hashA = computeShareContentHash(
      createShareHashInputFromSingleGame({ userId: "user-1", gameData }),
    );
    const hashB = computeShareContentHash(
      createShareHashInputFromSingleGame({ userId: "user-2", gameData }),
    );
    const hashC = computeShareContentHash(
      createShareHashInputFromSingleGame({
        userId: "user-1",
        gameData: {
          ...gameData,
          original: createChessGame("3002"),
        },
      }),
    );

    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it("uses a SHA-256 based hash format", () => {
    const gameData: SingleGameData = {
      original: createChessGame("5001"),
      partner: createChessGame("6001"),
      partnerId: "6001",
    };

    const hash = computeShareContentHash(
      createShareHashInputFromSingleGame({ userId: "user-1", gameData }),
    );

    expect(hash).toMatch(/^bh2_[a-f0-9]{64}$/);
  });
});
