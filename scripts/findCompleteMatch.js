/**
 * Script to find a complete match by searching all 4 players' game histories.
 *
 * This addresses the issue where Chess.com's archive for a single player
 * may be missing some games, but those games might appear in other players' archives.
 *
 * Usage: node scripts/findCompleteMatch.js <gameId>
 * Example: node scripts/findCompleteMatch.js 158281644905
 */

async function fetchGame(gameId) {
  const response = await fetch(
    `https://www.chess.com/callback/live/game/${gameId}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

async function fetchPlayerArchive(username, year, month) {
  const monthStr = month.toString().padStart(2, "0");
  const response = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${year}/${monthStr}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "BughouseAnalysis/1.0 (bughouse.aronteh.com)",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return []; // Player doesn't exist or has no games for this month
    }
    throw new Error(`Failed to fetch archive: ${response.status}`);
  }

  const data = await response.json();
  return data.games ?? [];
}

function extractGameIdFromUrl(url) {
  if (!url) return null;
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
    return match ? match[1] : null;
  }
}

function extractTeamComposition(game1, game2) {
  const getWhitePlayer = (game) => {
    if (game.players.top.color?.toLowerCase() === "white") return game.players.top.username.toLowerCase();
    if (game.players.bottom.color?.toLowerCase() === "white") return game.players.bottom.username.toLowerCase();
    return game.players.top.username.toLowerCase();
  };

  const getBlackPlayer = (game) => {
    if (game.players.top.color?.toLowerCase() === "black") return game.players.top.username.toLowerCase();
    if (game.players.bottom.color?.toLowerCase() === "black") return game.players.bottom.username.toLowerCase();
    return game.players.bottom.username.toLowerCase();
  };

  const boardAWhite = getWhitePlayer(game1);
  const boardABlack = getBlackPlayer(game1);
  const boardBWhite = getWhitePlayer(game2);
  const boardBBlack = getBlackPlayer(game2);

  const team1 = [boardAWhite, boardBBlack].sort();
  const team2 = [boardABlack, boardBWhite].sort();

  return { team1, team2 };
}

function areTeamsIdentical(comp1, comp2) {
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

function getAllPlayerUsernames(originalGame, partnerGame) {
  const players = new Set();

  players.add(originalGame.players.top.username.toLowerCase());
  players.add(originalGame.players.bottom.username.toLowerCase());
  players.add(partnerGame.players.top.username.toLowerCase());
  players.add(partnerGame.players.bottom.username.toLowerCase());

  return Array.from(players);
}

function parsePgnDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(year) || isNaN(month) || year < 2000 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Searches a single player's archive in one direction for matching games.
 */
async function searchPlayerArchive(
  playerUsername,
  initialEndTime,
  referenceTeams,
  direction,
  year,
  month,
  dayOfMonth
) {
  const MAX_TIME_GAP_SECONDS = 3600;
  const CONSECUTIVE_NON_MATCH_THRESHOLD = 3;
  const API_DELAY_MS = 250;

  const foundGames = [];
  let consecutiveNonMatches = 0;
  let lastFoundEndTime = initialEndTime;

  // Determine which months to check
  const monthsToCheck = [{ year, month }];

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
    // Reset consecutive non-matches when moving to a new month
    consecutiveNonMatches = 0;

    let archive;
    try {
      archive = await fetchPlayerArchive(playerUsername, checkYear, checkMonth);
      await delay(API_DELAY_MS); // Rate limiting
    } catch (error) {
      console.warn(`  Failed to fetch archive for ${playerUsername} ${checkYear}/${checkMonth}:`, error.message);
      continue;
    }

    // Filter and sort candidates
    let candidates;
    if (direction === "before") {
      candidates = archive
        .filter((g) => g.rules === "bughouse")
        .filter((g) => g.end_time < initialEndTime)
        .sort((a, b) => b.end_time - a.end_time);
    } else {
      candidates = archive
        .filter((g) => g.rules === "bughouse")
        .filter((g) => g.end_time > initialEndTime)
        .sort((a, b) => a.end_time - b.end_time);
    }

    for (const candidate of candidates) {
      // Check time gap first
      let timeGap;
      if (direction === "before") {
        timeGap = lastFoundEndTime - candidate.end_time;
      } else {
        timeGap = candidate.end_time - lastFoundEndTime;
      }

      if (timeGap > MAX_TIME_GAP_SECONDS) {
        // Time gap too large, stop searching this direction for this player
        break;
      }

      // Check consecutive non-matches
      if (consecutiveNonMatches >= CONSECUTIVE_NON_MATCH_THRESHOLD) {
        break;
      }

      const candidateGameId = extractGameIdFromUrl(candidate.url);
      if (!candidateGameId) {
        consecutiveNonMatches++;
        continue;
      }

      try {
        await delay(API_DELAY_MS);
        const candidateGame = await fetchGame(candidateGameId);
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
        const candidatePartner = await fetchGame(candidatePartnerId);
        if (!candidatePartner) {
          consecutiveNonMatches++;
          continue;
        }

        const candidateTeams = extractTeamComposition(candidateGame, candidatePartner);
        const isMatch = areTeamsIdentical(referenceTeams, candidateTeams);

        if (isMatch) {
          const matchGameEndTime = candidateGame.game.endTime ?? candidate.end_time;
          // Use the board A game ID as the primary identifier
          // (board A is the one we found in the archive)
          foundGames.push({
            gameId: candidateGameId,
            partnerGameId: candidatePartnerId,
            endTime: matchGameEndTime,
            foundViaPlayer: playerUsername,
            direction,
          });
          consecutiveNonMatches = 0;
          lastFoundEndTime = matchGameEndTime;
        } else {
          consecutiveNonMatches++;
        }
      } catch (error) {
        console.warn(`  Error checking game ${candidateGameId}:`, error.message);
        consecutiveNonMatches++;
      }
    }
  }

  return foundGames;
}

async function main() {
  const gameId = process.argv[2];

  if (!gameId) {
    console.error("Usage: node scripts/findCompleteMatch.js <gameId>");
    console.error("Example: node scripts/findCompleteMatch.js 158281644905");
    process.exit(1);
  }

  console.log(`Finding complete match starting from game ${gameId}...\n`);

  // Fetch initial game
  console.log("Fetching initial game...");
  const initialGame = await fetchGame(gameId);
  if (!initialGame) {
    console.error(`Could not fetch game ${gameId}`);
    process.exit(1);
  }

  const partnerId = initialGame.game.partnerGameId?.toString();
  if (!partnerId) {
    console.error("No partner game ID found");
    process.exit(1);
  }

  console.log("Fetching partner game...");
  const partnerGame = await fetchGame(partnerId);
  if (!partnerGame) {
    console.error("Could not fetch partner game");
    process.exit(1);
  }

  // Extract reference teams and all players
  const referenceTeams = extractTeamComposition(initialGame, partnerGame);
  const allPlayers = getAllPlayerUsernames(initialGame, partnerGame);
  const initialEndTime = initialGame.game.endTime;
  const date = initialGame.game.pgnHeaders.Date;
  const dateInfo = parsePgnDate(date);

  if (!dateInfo) {
    console.error("Could not parse game date");
    process.exit(1);
  }

  const { year, month } = dateInfo;
  const dayOfMonth = parseInt(date.split(".")[2] ?? "15", 10);

  console.log("\n=== Match Information ===");
  console.log(`Reference teams:`, referenceTeams);
  console.log(`All players:`, allPlayers);
  console.log(`Initial game end time: ${initialEndTime}`);
  console.log(`Date: ${date} (${year}/${month}, day ${dayOfMonth})\n`);

  // Helper function to check if a game pair is already in our results
  // A game pair is the same if either:
  // - gameId matches an existing gameId or partnerGameId
  // - partnerGameId matches an existing gameId or partnerGameId
  function isGamePairAlreadyFound(gameId, partnerGameId, foundGames) {
    for (const existing of foundGames.values()) {
      if (
        (existing.gameId === gameId || existing.gameId === partnerGameId) ||
        (existing.partnerGameId === gameId || existing.partnerGameId === partnerGameId)
      ) {
        return existing;
      }
    }
    return null;
  }

  // Add initial game to results
  const allFoundGames = new Map();
  // Use gameId as the key for the initial game
  allFoundGames.set(gameId, {
    gameId,
    partnerGameId: partnerId,
    endTime: initialEndTime,
    foundViaPlayer: "initial",
    direction: "initial",
  });

  // Search each player's archive in both directions
  console.log("=== Searching All Players' Archives ===\n");

  for (const player of allPlayers) {
    console.log(`Searching ${player}'s archive...`);

    // Search backward
    console.log(`  Searching backward...`);
    const backwardGames = await searchPlayerArchive(
      player,
      initialEndTime,
      referenceTeams,
      "before",
      year,
      month,
      dayOfMonth
    );
    console.log(`    Found ${backwardGames.length} games`);

    for (const game of backwardGames) {
      const existing = isGamePairAlreadyFound(game.gameId, game.partnerGameId, allFoundGames);
      if (!existing) {
        // Use gameId as the key
        allFoundGames.set(game.gameId, game);
        console.log(`    ✅ New game found: ${game.gameId} (via ${game.foundViaPlayer})`);
      } else {
        // Game already found, just update which players found it
        if (!existing.foundViaPlayer.includes(player)) {
          existing.foundViaPlayer += `, ${player}`;
        }
      }
    }

    // Search forward
    console.log(`  Searching forward...`);
    const forwardGames = await searchPlayerArchive(
      player,
      initialEndTime,
      referenceTeams,
      "after",
      year,
      month,
      dayOfMonth
    );
    console.log(`    Found ${forwardGames.length} games`);

    for (const game of forwardGames) {
      const existing = isGamePairAlreadyFound(game.gameId, game.partnerGameId, allFoundGames);
      if (!existing) {
        // Use gameId as the key
        allFoundGames.set(game.gameId, game);
        console.log(`    ✅ New game found: ${game.gameId} (via ${game.foundViaPlayer})`);
      } else {
        // Game already found, just update which players found it
        if (!existing.foundViaPlayer.includes(player)) {
          existing.foundViaPlayer += `, ${player}`;
        }
      }
    }

    console.log();
  }

  // Sort all games by endTime
  const sortedGames = Array.from(allFoundGames.values()).sort((a, b) => a.endTime - b.endTime);

  // Check if the initial game is in the results
  const initialGameInResults = sortedGames.find(g =>
    g.gameId === gameId || g.partnerGameId === gameId ||
    g.gameId === partnerId || g.partnerGameId === partnerId
  );

  // Find initial game index
  const initialGameIndex = sortedGames.findIndex(g =>
    g.gameId === gameId || g.partnerGameId === gameId ||
    g.gameId === partnerId || g.partnerGameId === partnerId
  );

  console.log("=== Results ===");
  console.log(`Total games found: ${sortedGames.length}`);
  console.log(`Initial game index: ${initialGameIndex >= 0 ? initialGameIndex : "NOT FOUND"}`);

  // Check if initial game was found in any player's archive
  if (initialGameInResults) {
    if (initialGameInResults.foundViaPlayer === "initial") {
      console.log(`\n⚠️  Initial game (${gameId}) was NOT found in any player's archive.`);
      console.log(`   This suggests Chess.com saved the game but didn't add it to any player's history.`);
    } else {
      console.log(`\n✅ Initial game (${gameId}) was found in player archive(s): ${initialGameInResults.foundViaPlayer}`);
    }
  } else {
    console.log(`\n❌ Initial game (${gameId}) is NOT in the results at all!`);
    console.log(`   This is unexpected - the game should have been added initially.`);
  }

  console.log(`\nGames in chronological order:`);

  sortedGames.forEach((game, idx) => {
    const isInitial = game.gameId === gameId || game.partnerGameId === gameId ||
                     game.gameId === partnerId || game.partnerGameId === partnerId;
    const marker = isInitial ? " 👈 INITIAL" : "";
    console.log(`  ${idx + 1}. ${game.gameId} (endTime: ${game.endTime}, found via: ${game.foundViaPlayer})${marker}`);
  });

  // Analyze which players found which games
  console.log(`\n=== Analysis ===`);
  const playerCoverage = new Map();
  for (const player of allPlayers) {
    playerCoverage.set(player, 0);
  }

  for (const game of sortedGames) {
    if (game.foundViaPlayer !== "initial") {
      const players = game.foundViaPlayer.split(", ");
      for (const player of players) {
        playerCoverage.set(player, (playerCoverage.get(player) || 0) + 1);
      }
    }
  }

  console.log("Games found per player (excluding initial game):");
  for (const [player, count] of playerCoverage.entries()) {
    console.log(`  ${player}: ${count} games`);
  }

  // Check if we found the expected 32 games
  console.log(`\n=== Summary ===`);
  if (sortedGames.length === 32) {
    console.log(`✅ SUCCESS! Found all 32 games by searching all 4 players' archives.`);
  } else {
    console.log(`⚠️  Found ${sortedGames.length} games (expected 32).`);
  }

  if (initialGameInResults && initialGameInResults.foundViaPlayer === "initial") {
    console.log(`\n📋 HYPOTHESIS: The initial game (${gameId}) exists and was saved by Chess.com,`);
    console.log(`   but it was NOT added to any of the 4 players' game histories.`);
    console.log(`   This explains why it doesn't appear in archive searches.`);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
