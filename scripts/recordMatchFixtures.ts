#!/usr/bin/env tsx
/**
 * Records chess.com match game payloads as fixtures for testing.
 *
 * This script fetches all games in a match or partner series by using
 * match discovery logic to find all related games.
 *
 * Usage:
 *   npx tsx scripts/recordMatchFixtures.ts <gameId> [--partner-only <username1> <username2>]
 *
 * Examples:
 *   # Record all games in a 4-person match
 *   npx tsx scripts/recordMatchFixtures.ts 160842422747
 *
 *   # Record only games where specific partners played together
 *   npx tsx scripts/recordMatchFixtures.ts 161530622681 --partner-only player1 player2
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ChessGame {
  game: {
    id: number;
    uuid: string;
    moveList: string;
    type: string;
    typeName: string;
    partnerGameId?: number;
    endTime?: number;
    pgnHeaders: {
      Date: string;
      White: string;
      Black: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  players: {
    top: {
      username: string;
      color?: string;
      [key: string]: unknown;
    };
    bottom: {
      username: string;
      color?: string;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

interface PublicGameRecord {
  url: string;
  rules: string;
  end_time: number;
  [key: string]: unknown;
}

interface MatchGame {
  gameId: string;
  partnerGameId: string;
  endTime: number;
  original: ChessGame;
  partner: ChessGame;
}

type TeamComposition = {
  team1: [string, string];
  team2: [string, string];
};

type PartnerPair = {
  usernames: [string, string];
  displayNames: [string, string];
};

/* -------------------------------------------------------------------------- */
/* API Functions                                                              */
/* -------------------------------------------------------------------------- */

const API_DELAY_MS = 300;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChessGame(gameId: string): Promise<ChessGame | null> {
  const response = await fetch(
    `https://www.chess.com/callback/live/game/${gameId}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch game ${gameId}: ${response.status}`);
  }

  return await response.json();
}

async function fetchPlayerArchive(
  username: string,
  year: number,
  month: number,
): Promise<PublicGameRecord[]> {
  const monthStr = month.toString().padStart(2, "0");
  const response = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${year}/${monthStr}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "BughouseAnalysis/1.0 (bughouse.aronteh.com)",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Failed to fetch archive: ${response.status}`);
  }

  const data = await response.json();
  return data.games ?? [];
}

/* -------------------------------------------------------------------------- */
/* Match Discovery Logic                                                      */
/* -------------------------------------------------------------------------- */

function extractGameIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && /^\d{12}$/.test(lastSegment)) {
      return lastSegment;
    }
    return null;
  } catch {
    const match = url.match(/\/(\d{12})(?:\/|$)/);
    return match ? match[1] ?? null : null;
  }
}

function getWhitePlayer(game: ChessGame): string {
  if (game.players.top.color?.toLowerCase() === "white") return game.players.top.username.toLowerCase();
  if (game.players.bottom.color?.toLowerCase() === "white") return game.players.bottom.username.toLowerCase();
  return game.players.top.username.toLowerCase();
}

function getBlackPlayer(game: ChessGame): string {
  if (game.players.top.color?.toLowerCase() === "black") return game.players.top.username.toLowerCase();
  if (game.players.bottom.color?.toLowerCase() === "black") return game.players.bottom.username.toLowerCase();
  return game.players.bottom.username.toLowerCase();
}

function extractTeamComposition(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
): TeamComposition {
  const boardAWhite = getWhitePlayer(originalGame);
  const boardABlack = getBlackPlayer(originalGame);
  const boardBWhite = partnerGame ? getWhitePlayer(partnerGame) : "";
  const boardBBlack = partnerGame ? getBlackPlayer(partnerGame) : "";

  const team1: [string, string] = [boardAWhite, boardBBlack].sort() as [string, string];
  const team2: [string, string] = [boardABlack, boardBWhite].sort() as [string, string];

  return { team1, team2 };
}

function areTeamsIdentical(comp1: TeamComposition, comp2: TeamComposition): boolean {
  const directMatch =
    comp1.team1[0] === comp2.team1[0] &&
    comp1.team1[1] === comp2.team1[1] &&
    comp1.team2[0] === comp2.team2[0] &&
    comp1.team2[1] === comp2.team2[1];

  const swappedMatch =
    comp1.team1[0] === comp2.team2[0] &&
    comp1.team1[1] === comp2.team2[1] &&
    comp1.team2[0] === comp2.team1[0] &&
    comp1.team2[1] === comp2.team1[1];

  return directMatch || swappedMatch;
}

function isPartnerPairPresent(pair: PartnerPair, composition: TeamComposition): boolean {
  const [p1, p2] = pair.usernames;
  const matchesTeam1 = composition.team1[0] === p1 && composition.team1[1] === p2;
  const matchesTeam2 = composition.team2[0] === p1 && composition.team2[1] === p2;
  return matchesTeam1 || matchesTeam2;
}

function getAllPlayerUsernames(originalGame: ChessGame, partnerGame: ChessGame | null): string[] {
  const players = new Set<string>();
  players.add(originalGame.players.top.username.toLowerCase());
  players.add(originalGame.players.bottom.username.toLowerCase());
  if (partnerGame) {
    players.add(partnerGame.players.top.username.toLowerCase());
    players.add(partnerGame.players.bottom.username.toLowerCase());
  }
  return Array.from(players);
}

function parsePgnDate(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);

  if (isNaN(year) || isNaN(month) || year < 2000 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

/* -------------------------------------------------------------------------- */
/* Match Discovery                                                            */
/* -------------------------------------------------------------------------- */

const MAX_TIME_GAP_SECONDS = 3600;
const CONSECUTIVE_NON_MATCH_THRESHOLD = 3;

async function discoverMatchGames(
  initialGame: ChessGame,
  partnerGame: ChessGame | null,
  partnerId: string | null,
  mode: "fullMatch" | "partnerPair",
  selectedPair?: PartnerPair,
): Promise<MatchGame[]> {
  const referenceTeams = extractTeamComposition(initialGame, partnerGame);
  const initialEndTime = initialGame.game.endTime ?? 0;

  const dateInfo = parsePgnDate(initialGame.game.pgnHeaders.Date);
  if (!dateInfo) {
    throw new Error("Cannot parse game date");
  }

  const archivePlayer =
    mode === "partnerPair" && selectedPair
      ? selectedPair.usernames[0]
      : getAllPlayerUsernames(initialGame, partnerGame)[0];

  const { year, month } = dateInfo;
  const dayOfMonth = parseInt(initialGame.game.pgnHeaders.Date.split(".")[2] ?? "15", 10);

  // Create initial match game
  const initialMatchGame: MatchGame = {
    gameId: initialGame.game.id.toString(),
    partnerGameId: partnerId ?? "",
    original: initialGame,
    partner: partnerGame!,
    endTime: initialEndTime,
  };

  const allFoundGames = new Map<string, MatchGame>();
  allFoundGames.set(initialMatchGame.gameId, initialMatchGame);

  // Search in both directions
  for (const direction of ["before", "after"] as const) {
    let consecutiveNonMatches = 0;
    let lastFoundEndTime = initialEndTime;

    const monthsToCheck: Array<{ year: number; month: number }> = [{ year, month }];
    if (direction === "before" && dayOfMonth <= 15) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      monthsToCheck.push({ year: prevYear, month: prevMonth });
    } else if (direction === "after" && dayOfMonth >= 15) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      monthsToCheck.push({ year: nextYear, month: nextMonth });
    }

    for (const { year: checkYear, month: checkMonth } of monthsToCheck) {
      if (consecutiveNonMatches >= CONSECUTIVE_NON_MATCH_THRESHOLD) break;

      let archive: PublicGameRecord[];
      try {
        await delay(API_DELAY_MS);
        archive = await fetchPlayerArchive(archivePlayer!, checkYear, checkMonth);
      } catch {
        console.warn(`  Failed to fetch archive for ${archivePlayer} ${checkYear}/${checkMonth}`);
        continue;
      }

      let candidates: PublicGameRecord[];
      if (direction === "before") {
        candidates = archive
          .filter((g) => g.rules === "bughouse" && g.end_time < initialEndTime)
          .sort((a, b) => b.end_time - a.end_time);
      } else {
        candidates = archive
          .filter((g) => g.rules === "bughouse" && g.end_time > initialEndTime)
          .sort((a, b) => a.end_time - b.end_time);
      }

      for (const candidate of candidates) {
        if (consecutiveNonMatches >= CONSECUTIVE_NON_MATCH_THRESHOLD) break;

        const timeGap =
          direction === "before"
            ? lastFoundEndTime - candidate.end_time
            : candidate.end_time - lastFoundEndTime;

        if (timeGap > MAX_TIME_GAP_SECONDS) break;

        const candidateGameId = extractGameIdFromUrl(candidate.url);
        if (!candidateGameId) {
          consecutiveNonMatches++;
          continue;
        }

        // Skip if already found
        if (allFoundGames.has(candidateGameId)) continue;

        try {
          await delay(API_DELAY_MS);
          const candidateGame = await fetchChessGame(candidateGameId);
          if (!candidateGame) {
            consecutiveNonMatches++;
            continue;
          }

          const candidatePartnerId = candidateGame.game.partnerGameId?.toString();
          if (!candidatePartnerId) {
            consecutiveNonMatches++;
            continue;
          }

          await delay(API_DELAY_MS);
          const candidatePartner = await fetchChessGame(candidatePartnerId);
          if (!candidatePartner) {
            consecutiveNonMatches++;
            continue;
          }

          const candidateTeams = extractTeamComposition(candidateGame, candidatePartner);
          let isMatch: boolean;

          if (mode === "partnerPair" && selectedPair) {
            isMatch = isPartnerPairPresent(selectedPair, candidateTeams);
          } else {
            isMatch = areTeamsIdentical(referenceTeams, candidateTeams);
          }

          if (!isMatch) {
            consecutiveNonMatches++;
            continue;
          }

          // Match found!
          consecutiveNonMatches = 0;
          const matchGameEndTime = candidateGame.game.endTime ?? candidate.end_time;
          lastFoundEndTime = matchGameEndTime;

          const matchGame: MatchGame = {
            gameId: candidateGameId,
            partnerGameId: candidatePartnerId,
            original: candidateGame,
            partner: candidatePartner,
            endTime: matchGameEndTime,
          };

          allFoundGames.set(candidateGameId, matchGame);
          console.log(`  ✅ Found game ${candidateGameId} (${direction})`);
        } catch (error) {
          console.warn(`  Error checking game ${candidateGameId}:`, error);
          consecutiveNonMatches++;
        }
      }
    }
  }

  // Sort by endTime
  return Array.from(allFoundGames.values()).sort((a, b) => a.endTime - b.endTime);
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  npx tsx scripts/recordMatchFixtures.ts <gameId>");
    console.log("  npx tsx scripts/recordMatchFixtures.ts <gameId> --partner-only <user1> <user2>");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx scripts/recordMatchFixtures.ts 160842422747");
    console.log("  npx tsx scripts/recordMatchFixtures.ts 161530622681 --partner-only player1 player2");
    process.exit(0);
  }

  const gameId = args[0]!;
  const partnerOnlyIndex = args.indexOf("--partner-only");
  let mode: "fullMatch" | "partnerPair" = "fullMatch";
  let selectedPair: PartnerPair | undefined;

  if (partnerOnlyIndex !== -1) {
    mode = "partnerPair";
    const user1 = args[partnerOnlyIndex + 1];
    const user2 = args[partnerOnlyIndex + 2];
    if (!user1 || !user2) {
      console.error("Error: --partner-only requires two usernames");
      process.exit(1);
    }
    const usernames = [user1.toLowerCase(), user2.toLowerCase()].sort() as [string, string];
    selectedPair = {
      usernames,
      displayNames: [user1, user2],
    };
    console.log(`Recording partner series for ${user1} + ${user2}`);
  } else {
    console.log("Recording full match fixtures");
  }

  const fixturesDir = join(process.cwd(), "tests", "fixtures", "chesscom");
  mkdirSync(fixturesDir, { recursive: true });

  console.log(`\nFetching initial game ${gameId}...`);
  const initialGame = await fetchChessGame(gameId);
  if (!initialGame) {
    console.error(`Could not fetch game ${gameId}`);
    process.exit(1);
  }

  const partnerId = initialGame.game.partnerGameId?.toString() ?? null;
  let partnerGame: ChessGame | null = null;

  if (partnerId) {
    console.log(`Fetching partner game ${partnerId}...`);
    partnerGame = await fetchChessGame(partnerId);
  }

  if (!partnerGame) {
    console.error("Could not fetch partner game - this may not be a bughouse game");
    process.exit(1);
  }

  console.log("\nDiscovering match games...");
  const matchGames = await discoverMatchGames(
    initialGame,
    partnerGame,
    partnerId,
    mode,
    selectedPair,
  );

  console.log(`\nFound ${matchGames.length} games in ${mode === "partnerPair" ? "partner series" : "match"}`);

  // Save all games
  console.log("\nSaving fixtures...");
  const savedGameIds = new Set<string>();

  for (const matchGame of matchGames) {
    // Save original game
    if (!savedGameIds.has(matchGame.gameId)) {
      const gamePath = join(fixturesDir, `${matchGame.gameId}.json`);
      writeFileSync(gamePath, JSON.stringify(matchGame.original, null, 2), "utf-8");
      savedGameIds.add(matchGame.gameId);
      console.log(`  ✓ Saved ${matchGame.gameId}.json`);
    }

    // Save partner game
    if (!savedGameIds.has(matchGame.partnerGameId)) {
      const partnerPath = join(fixturesDir, `${matchGame.partnerGameId}.json`);
      writeFileSync(partnerPath, JSON.stringify(matchGame.partner, null, 2), "utf-8");
      savedGameIds.add(matchGame.partnerGameId);
      console.log(`  ✓ Saved ${matchGame.partnerGameId}.json`);
    }
  }

  // Create an index file with metadata
  const indexPath = join(fixturesDir, mode === "partnerPair" ? "partner-series-index.json" : "match-index.json");
  const indexData = {
    mode,
    initialGameId: gameId,
    totalGames: matchGames.length,
    selectedPair: selectedPair?.usernames,
    games: matchGames.map((g) => ({
      gameId: g.gameId,
      partnerGameId: g.partnerGameId,
      endTime: g.endTime,
    })),
    recordedAt: new Date().toISOString(),
  };
  writeFileSync(indexPath, JSON.stringify(indexData, null, 2), "utf-8");
  console.log(`\n✓ Saved index to ${mode === "partnerPair" ? "partner-series-index.json" : "match-index.json"}`);

  console.log(`\n✅ Done! Recorded ${savedGameIds.size} game fixture files.`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
