import type { SharedGameSummary } from "../types/sharedGame";

/**
 * Filter options for shared games.
 * P1/P2 represent one team (Team A), P3/P4 represent the other team (Team B).
 * Player positions within a team are agnostic (P1/P2 can swap, P3/P4 can swap).
 * Team orientation is agnostic (Team A can be team1 OR team2, Team B can be team1 OR team2).
 * - If filters are from both groups (P1/P2 AND P3/P4): must be on opposite teams
 * - If filters are from only one group (only P1/P2 or only P3/P4): must be on the same team
 */
export interface SharedGamesFilter {
  /**
   * Player filter 1 - can match any player position.
   */
  player1?: string;

  /**
   * Player filter 2 - can match any player position.
   */
  player2?: string;

  /**
   * Player filter 3 - can match any player position.
   */
  player3?: string;

  /**
   * Player filter 4 - can match any player position.
   */
  player4?: string;

  /**
   * Sharer filter - matches the sharer username.
   */
  sharer?: string;
}

/**
 * Filters shared games based on the provided filter criteria.
 *
 * Filtering rules:
 * - P1/P2 represent one team (Team A), P3/P4 represent the other team (Team B)
 * - Player positions within a team are agnostic (P1/P2 can swap, P3/P4 can swap)
 * - Team orientation is agnostic (Team A can be team1 OR team2, Team B can be team1 OR team2)
 * - If filters are from both groups (P1/P2 AND P3/P4): must be on opposite teams
 * - If filters are from only one group (only P1/P2 or only P3/P4): must be on the same team
 * - All filters are case-insensitive substring matches
 * - Empty filters are ignored
 *
 * @param games - Array of shared games to filter
 * @param filter - Filter criteria
 * @returns Filtered array of shared games
 */
export function filterSharedGames(
  games: SharedGameSummary[],
  filter: SharedGamesFilter,
): SharedGameSummary[] {
  const { player1, player2, player3, player4, sharer } = filter;

  // If no filters are active, return all games
  if (!player1 && !player2 && !player3 && !player4 && !sharer) {
    return games;
  }

  // Collect filters by group: Team A (P1/P2) and Team B (P3/P4)
  const teamAFilters: Array<{ value: string; index: number }> = [];
  const teamBFilters: Array<{ value: string; index: number }> = [];

  if (player1?.trim()) {
    teamAFilters.push({ value: player1.trim(), index: 0 });
  }
  if (player2?.trim()) {
    teamAFilters.push({ value: player2.trim(), index: 1 });
  }
  if (player3?.trim()) {
    teamBFilters.push({ value: player3.trim(), index: 2 });
  }
  if (player4?.trim()) {
    teamBFilters.push({ value: player4.trim(), index: 3 });
  }

  const hasTeamAFilters = teamAFilters.length > 0;
  const hasTeamBFilters = teamBFilters.length > 0;
  const allFilters = [...teamAFilters, ...teamBFilters];

  return games.filter((game) => {
    const { team1, team2 } = game.metadata;

    // Get all player usernames (case-insensitive for matching)
    // Indices: 0=team1.player1, 1=team1.player2, 2=team2.player1, 3=team2.player2
    const allPlayers = [
      team1.player1.username.toLowerCase(),
      team1.player2.username.toLowerCase(),
      team2.player1.username.toLowerCase(),
      team2.player2.username.toLowerCase(),
    ];

    // Check sharer filter first (independent of player filters)
    if (sharer?.trim()) {
      const sharerLower = sharer.toLowerCase().trim();
      if (!game.sharerUsername.toLowerCase().includes(sharerLower)) {
        return false;
      }
    }

    // If no player filters, we're done (sharer filter already checked)
    if (allFilters.length === 0) {
      return true;
    }

    // For single player filter: match if found in any position
    if (allFilters.length === 1) {
      const filterLower = allFilters[0]!.value.toLowerCase();
      return allPlayers.some((player) => player.includes(filterLower));
    }

    // Find all possible matches for each filter
    // matches[i] = array of player indices that match filter i
    const matches: number[][] = allFilters.map((filter) => {
      const filterLower = filter.value.toLowerCase();
      const playerMatches: number[] = [];
      for (let i = 0; i < allPlayers.length; i++) {
        if (allPlayers[i]!.includes(filterLower)) {
          playerMatches.push(i);
        }
      }
      return playerMatches;
    });

    // Check if any filter has no matches
    if (matches.some((m) => m.length === 0)) {
      return false;
    }

    // Determine team requirements based on which filter groups are used
    const requireOppositeTeams = hasTeamAFilters && hasTeamBFilters;
    const requireSameTeam = (hasTeamAFilters && !hasTeamBFilters) || (!hasTeamAFilters && hasTeamBFilters);

    // Track which filter index belongs to which group
    // allFilters = [teamAFilters..., teamBFilters...]
    const teamAFilterIndices = new Set(
      teamAFilters.map((_, idx) => idx),
    );
    const teamBFilterIndices = new Set(
      teamBFilters.map((_, idx) => teamAFilters.length + idx),
    );

    // Try to assign each filter to a distinct player
    // Track which team each filter group is assigned to
    function canAssignFilters(
      filterIndex: number,
      usedPlayers: Set<number>,
      teamATeam: number | null, // 0=team1, 1=team2, null=not assigned
      teamBTeam: number | null,
    ): boolean {
      if (filterIndex >= matches.length) {
        // All filters assigned - check team requirements
        if (requireOppositeTeams) {
          // Filters from both groups: must be on opposite teams
          return (
            teamATeam !== null &&
            teamBTeam !== null &&
            teamATeam !== teamBTeam
          );
        } else if (requireSameTeam) {
          // Filters from only one group: must be on the same team (either team1 or team2, but not both)
          const assignedTeam = teamATeam ?? teamBTeam;
          return assignedTeam !== null;
        }
        return true;
      }

      const possibleMatches = matches[filterIndex]!;
      const isTeamAFilter = teamAFilterIndices.has(filterIndex);
      const isTeamBFilter = teamBFilterIndices.has(filterIndex);

      for (const playerIndex of possibleMatches) {
        if (usedPlayers.has(playerIndex)) continue; // Already assigned

        const playerTeam = playerIndex < 2 ? 0 : 1; // 0=team1, 1=team2

        // Check if this assignment is valid for the filter's group
        if (isTeamAFilter) {
          // Team A filters must all be on the same team
          if (teamATeam !== null && teamATeam !== playerTeam) {
            continue; // Invalid - Team A already assigned to different team
          }
        } else if (isTeamBFilter) {
          // Team B filters must all be on the same team
          if (teamBTeam !== null && teamBTeam !== playerTeam) {
            continue; // Invalid - Team B already assigned to different team
          }
        }

        usedPlayers.add(playerIndex);
        const newTeamATeam = isTeamAFilter ? playerTeam : teamATeam;
        const newTeamBTeam = isTeamBFilter ? playerTeam : teamBTeam;

        if (
          canAssignFilters(
            filterIndex + 1,
            usedPlayers,
            newTeamATeam,
            newTeamBTeam,
          )
        ) {
          return true;
        }
        usedPlayers.delete(playerIndex);
      }

      return false;
    }

    return canAssignFilters(0, new Set(), null, null);
  });
}
