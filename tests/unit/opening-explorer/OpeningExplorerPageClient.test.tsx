/**
 * Unit tests for {@link OpeningExplorerPageClient}.
 *
 * Validates the hosted opening-explorer page client contract against mocked
 * API boundaries: neighborhood prefetch/cache reuse, TCN-to-SAN move decoding,
 * keyboard navigation, player-filter overlay reloads, bounded-cache ancestor
 * pinning, sole-game/source-game link behavior, layout regions, and idle
 * frontier refill stability.
 *
 * Mocks isolate Next.js routing and the opening-explorer HTTP client so tests
 * exercise UI/state invariants without a live dataset service.
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Hoisted mock handles shared across vi.mock factories and test bodies. */
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  metadata: vi.fn(),
  neighborhood: vi.fn(),
  games: vi.fn(),
  players: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams(),
}));

vi.mock("@/app/components/board/ChessBoard", () => ({
  default: ({ fen }: { fen: string }) => <div data-testid="single-opening-board" data-fen={fen} />,
}));

vi.mock("@/app/components/opening-explorer/api", () => ({
  OpeningExplorerApiError: class extends Error {},
  OpeningExplorerApi: class {
    metadata = async (...args: unknown[]) => {
      const metadata = await mocks.metadata(...args);
      return {
        ...metadata,
        format_version: "packed-position-graph-v1",
        replay_policy: metadata.replay_policy ?? "skip-unreplayable-source-game-v1",
        root_state_id: metadata.root_state_id ?? 0,
        terminal_policy: "full-replay-game-end-v1",
      };
    };
    neighborhood = async (...args: unknown[]) => toGraphResponse(await mocks.neighborhood(...args));
    edgeGameExamples = mocks.games;
    searchPlayers = mocks.players;
  },
}));

import OpeningExplorerPageClient from "@/app/components/opening-explorer/OpeningExplorerPageClient";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const STATE_FENS: Record<number, string> = {
  0: START,
  1: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
  2: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3",
  3: "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -",
};
const MOVE_LABELS: Record<string, string> = { gv: "Nf3", lB: "d4", mC: "e4" };

/** Upgrade legacy prefix fixtures so the suite exercises the graph client contract. */
/* eslint-disable @typescript-eslint/no-explicit-any -- bounded adapter for legacy-shaped fixtures */
function toGraphResponse(response: any) {
  if (Array.isArray(response.states)) return response;
  const states = response.nodes.map((node: any) => ({
    id: node.id,
    node_id: node.id,
    outgoing_count: node.child_count,
    position_fen: STATE_FENS[node.id] ?? START,
  }));
  const edges = response.edges.map((edge: any) => ({
    child_id: edge.child_id,
    child_state_id: edge.child_id,
    id: edge.child_id,
    move_label: MOVE_LABELS[edge.move_token] ?? edge.move_token,
    move_token: edge.move_token,
    parent_state_id: edge.parent_id,
  }));
  return {
    ...response,
    anchor_state_id: response.anchor_node_id,
    edge_overlays: Object.fromEntries(edges.map((edge: any) => [
      String(edge.id),
      {
        results: response.overlays[String(edge.child_id)]?.results ?? {},
        sole_game_ordinal: response.overlays[String(edge.child_id)]?.sole_game_ordinal ?? null,
        support: response.overlays[String(edge.child_id)]?.support ?? 0,
      },
    ])),
    edges,
    frontiers: response.frontiers.map((frontier: any) => ({
      ...frontier,
      state_id: frontier.node_id,
    })),
    instrumentation: {
      ...response.instrumentation,
      returned_states: states.length,
    },
    node_overlays: Object.fromEntries(response.nodes.map((node: any) => [
      String(node.id),
      { support: response.overlays[String(node.id)]?.support ?? 0 },
    ])),
    nodes: response.nodes.map((node: any) => ({
      id: node.id,
      placement: (STATE_FENS[node.id] ?? START).split(" ")[0],
      support: response.overlays[String(node.id)]?.support ?? 0,
    })),
    state_overlays: response.overlays,
    states,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Minimal neighborhood fixture: root with one child (`mC` → e4).
 * Reused as the default mock response so most tests start from a known tree shape.
 */
const neighborhoodResponse = {
  anchor_node_id: 0,
  dataset_version: "dataset-1",
  edges: [{ child_id: 1, move_token: "mC", parent_id: 0 }],
  filter: null,
  frontiers: [],
  instrumentation: {
    budget_exception: false,
    elapsed_microseconds: 1,
    encoded_bytes: 500,
    returned_edges: 1,
    returned_nodes: 2,
    visited_nodes: 2,
  },
  nodes: [
    { child_count: 1, id: 0, interval_end: 7, interval_start: 0, move_token: null, parent_id: null, ply: 0 },
    { child_count: 0, id: 1, interval_end: 6, interval_start: 0, move_token: "mC", parent_id: 0, ply: 1 },
  ],
  overlays: {
    "0": { actual_ending_count: 0, results: { win: 7 }, sole_game_ordinal: null, support: 7 },
    "1": { actual_ending_count: 0, results: { win: 6 }, sole_game_ordinal: null, support: 6 },
  },
  path: [{ move_token: null, node_id: 0 }],
  target_forward_depth: 5,
};

/** Selects one indexed player through the searchable combobox. */
async function choosePlayer(username: string): Promise<void> {
  fireEvent.click(await screen.findByRole("combobox", { name: "Player" }));
  const search = screen.getByRole("searchbox", { name: "Search players" });
  fireEvent.change(search, { target: { value: username } });
  fireEvent.click(await screen.findByRole("option", { name: username }));
}

describe("OpeningExplorerPageClient", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.searchParams.mockReset();
    mocks.searchParams.mockReturnValue(new URLSearchParams());
    mocks.games.mockReset();
    mocks.games.mockResolvedValue({
      actual_ending_count: 0,
      dataset_version: "dataset-1",
      games: [],
      limit: 1,
      node_id: 0,
      total_matching: 0,
    });
    mocks.metadata.mockResolvedValue({
      adapter_policy: "opening-adapter-v2-short-non-checkmate",
      coverage: { accepted_games: 7, source_fingerprint: "fixture" },
      dataset_version: "dataset-1",
      format_version: "packed-prefix-interval-v1",
      root_node_id: 0,
      terminal_policy: "first-distinct-support-one-or-game-end-v1",
    });
    mocks.neighborhood.mockResolvedValue(neighborhoodResponse);
    mocks.players.mockResolvedValue([]);
  });

  it("sets a patient cold-start expectation only while the opening dataset loads", async () => {
    render(<OpeningExplorerPageClient />);

    expect(screen.getByText("Cold starts can take about 30 seconds. Please be patient.")).toBeInTheDocument();

    await screen.findByRole("heading", { name: "Opening explorer" });
    expect(screen.queryByText("Cold starts can take about 30 seconds. Please be patient.")).not.toBeInTheDocument();
  });

  it("uses nonzero graph root ids when the URL has no explicit anchor", async () => {
    mocks.metadata.mockResolvedValue({
      adapter_policy: "opening-adapter-v2-short-non-checkmate",
      coverage: { accepted_games: 1, source_fingerprint: "fixture" },
      dataset_version: "dataset-1",
      root_node_id: 12,
      root_state_id: 34,
    });
    mocks.neighborhood.mockResolvedValue({
      anchor_node_id: 12,
      anchor_state_id: 34,
      dataset_version: "dataset-1",
      edges: [],
      edge_overlays: {},
      filter: null,
      frontiers: [],
      instrumentation: {
        budget_exception: false,
        elapsed_microseconds: 1,
        encoded_bytes: 100,
        returned_edges: 0,
        returned_nodes: 1,
        returned_states: 1,
        visited_nodes: 1,
      },
      node_overlays: { "12": { support: 1 } },
      nodes: [{ id: 12, placement: START.split(" ")[0], support: 1 }],
      state_overlays: {
        "34": { actual_ending_count: 1, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
      },
      states: [{ id: 34, node_id: 12, outgoing_count: 0, position_fen: START }],
      target_forward_depth: 5,
    });

    render(<OpeningExplorerPageClient />);

    await screen.findByRole("heading", { name: "Opening explorer" });
    expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 12,
      stateId: 34,
    }));
    expect(screen.getByTestId("single-opening-board").dataset.fen).toContain(START);
  });

  it("ignores node and state ids from a stale dataset URL", async () => {
    mocks.searchParams.mockReturnValue(new URLSearchParams({
      dataset: "old-dataset",
      node: "999",
      state: "888",
    }));

    render(<OpeningExplorerPageClient />);

    await screen.findByRole("heading", { name: "Opening explorer" });
    expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      datasetVersion: "dataset-1",
      nodeId: 0,
      stateId: 0,
    }));
  });

  it("shows subsequent neighborhood loading inside the candidate move list", async () => {
    mocks.players.mockResolvedValue(["alice"]);
    let resolveRefresh: ((response: typeof neighborhoodResponse) => void) | undefined;
    mocks.neighborhood
      .mockResolvedValueOnce(neighborhoodResponse)
      .mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    render(<OpeningExplorerPageClient />);

    await choosePlayer("alice");
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply filter" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));

    const candidates = screen.getByLabelText("Candidate move choices");
    expect(within(candidates).getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.getByRole("region", { name: "Opening Tree" })).not.toHaveTextContent("0 games");
    expect(screen.queryByText("Refilling cache")).not.toBeInTheDocument();

    await act(async () => resolveRefresh?.(neighborhoodResponse));
    await waitFor(() => expect(within(candidates).queryByRole("status")).not.toBeInTheDocument());
  });

  it("publishes first-load phases to the browser performance timeline", async () => {
    const mark = vi.spyOn(performance, "mark");

    render(<OpeningExplorerPageClient />);

    await screen.findByRole("heading", { name: "Opening explorer" });
    await waitFor(() => expect(mark.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        "opening-explorer:hydrated",
        "opening-explorer:metadata-response",
        "opening-explorer:neighborhood-response",
        "opening-explorer:cache-merge",
        "opening-explorer:replay",
        "opening-explorer:first-useful-paint",
      ]),
    ));

    mark.mockRestore();
  });

  it("renders one board and navigates an already-prefetched child without another request", async () => {
    render(<OpeningExplorerPageClient />);

    await screen.findByRole("heading", { name: "Opening explorer" });
    expect(screen.getByText("HOSTED EXPERIMENT")).toBeInTheDocument();
    expect(screen.getByText(/7 accepted games/)).toBeInTheDocument();
    expect(screen.getAllByTestId("single-opening-board")).toHaveLength(1);
    const requestsBeforeClick = mocks.neighborhood.mock.calls.length;
    expect(requestsBeforeClick).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /e4/ }));

    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("4P3"));
    expect(mocks.neighborhood).toHaveBeenCalledTimes(requestsBeforeClick);
    expect(mocks.push).toHaveBeenCalledWith("/opening-explorer?node=1&state=1&dataset=dataset-1");
  });

  it("offers one searchable player combobox with a separate White or Black seat choice", async () => {
    render(<OpeningExplorerPageClient />);

    const controls = await screen.findByRole("complementary", { name: "Explorer controls" });
    expect(within(controls).getAllByRole("combobox")).toHaveLength(1);
    expect(within(controls).getByRole("combobox", { name: "Player" })).toHaveTextContent("Search for a player");
    expect(within(controls).getByRole("button", { name: "White" })).toHaveAttribute("aria-pressed", "true");
    expect(within(controls).getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows matching player suggestions while the user types", async () => {
    mocks.players.mockResolvedValue(["alice", "alicia"]);
    render(<OpeningExplorerPageClient />);

    fireEvent.click(await screen.findByRole("combobox", { name: "Player" }));
    const search = screen.getByRole("searchbox", { name: "Search players" });
    fireEvent.change(search, { target: { value: "al" } });

    const suggestions = await screen.findByRole("listbox", { name: "Player suggestions" });
    expect(within(suggestions).getByRole("option", { name: "alice" })).toBeInTheDocument();
    expect(within(suggestions).getByRole("option", { name: "alicia" })).toBeInTheDocument();
    expect(mocks.players).toHaveBeenLastCalledWith("dataset-1", "al");

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("searchbox", { name: "Search players" })).not.toBeInTheDocument();
  });

  it("keeps unknown searches inside the combobox and reapplies a filtered player when the seat changes", async () => {
    mocks.players.mockImplementation((_datasetVersion: string, prefix: string) => (
      Promise.resolve(prefix.toLowerCase() === "alice" ? ["alice"] : [])
    ));
    render(<OpeningExplorerPageClient />);

    fireEvent.click(await screen.findByRole("combobox", { name: "Player" }));
    const search = screen.getByRole("searchbox", { name: "Search players" });
    const apply = screen.getByRole("button", { name: "Apply filter" });

    fireEvent.change(search, { target: { value: "not-a-player" } });
    expect(await screen.findByText("No players found.")).toBeInTheDocument();
    expect(screen.queryByText("Choose a player from the indexed corpus.")).not.toBeInTheDocument();
    expect(apply).toBeDisabled();

    fireEvent.change(search, { target: { value: "alice" } });
    fireEvent.click(await screen.findByRole("option", { name: "alice" }));
    expect(screen.getByRole("combobox", { name: "Player" })).toHaveTextContent("alice");
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    await waitFor(() => expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      filter: { white: "alice", black: null },
    })));

    fireEvent.click(screen.getByRole("button", { name: "Black" }));
    await waitFor(() => expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      filter: { white: null, black: "alice" },
    })));
  });

  it("resets the board and explorer to the root when the filtered player is cleared", async () => {
    mocks.players.mockResolvedValue(["alice"]);
    mocks.neighborhood.mockImplementation((request: {
      filter?: { white?: string | null; black?: string | null };
      nodeId: number;
    }) => {
      if (request.nodeId === 1) {
        return Promise.resolve({
          ...neighborhoodResponse,
          anchor_node_id: 1,
          edges: [],
          filter: request.filter?.white
            ? { white_username: request.filter.white, black_username: null }
            : null,
          nodes: [neighborhoodResponse.nodes[1]],
          overlays: {
            "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
          },
          path: [
            { move_token: null, node_id: 0 },
            { move_token: "mC", node_id: 1 },
          ],
        });
      }

      return Promise.resolve(neighborhoodResponse);
    });

    render(<OpeningExplorerPageClient />);

    fireEvent.click(await screen.findByRole("button", { name: /e4, 6 games/i }));
    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("4P3"));

    await choosePlayer("alice");
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    await waitFor(() => expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 1,
      filter: { white: "alice", black: null },
    })));

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(screen.getByText("No moves yet")).toBeInTheDocument());
    expect(screen.getByTestId("single-opening-board").dataset.fen).toContain(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
    );
    expect(mocks.neighborhood).toHaveBeenLastCalledWith(expect.objectContaining({
      nodeId: 0,
      filter: { white: null, black: null },
    }));
    expect(mocks.push).toHaveBeenLastCalledWith("/opening-explorer?node=0&state=0&dataset=dataset-1");
  });

  it("shows decoded moves without TCN and sorts the move list by descending game count", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      edges: [
        { child_id: 2, move_token: "lB", parent_id: 0 },
        { child_id: 1, move_token: "mC", parent_id: 0 },
      ],
      nodes: [
        neighborhoodResponse.nodes[0],
        neighborhoodResponse.nodes[1],
        { child_count: 0, id: 2, interval_end: 7, interval_start: 6, move_token: "lB", parent_id: 0, ply: 1 },
      ],
      overlays: {
        ...neighborhoodResponse.overlays,
        "1": { actual_ending_count: 0, results: { win: 6 }, sole_game_ordinal: null, support: 6 },
        "2": { actual_ending_count: 0, results: { resigned: 1 }, sole_game_ordinal: 6, support: 1 },
      },
    });

    render(<OpeningExplorerPageClient />);

    const moveList = await screen.findByRole("region", { name: "Opening Tree" });
    const rows = [...within(moveList).getByLabelText("Candidate move choices").children];
    expect(rows[0]).toHaveTextContent("e4");
    expect(rows[1]).toHaveTextContent("d4");
    expect(within(moveList).queryByText("mC")).not.toBeInTheDocument();
    expect(within(moveList).queryByText("lB")).not.toBeInTheDocument();
  });

  it("lifts a unique-game child into a source link without advancing the board", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      edges: [
        { child_id: 1, move_token: "mC", parent_id: 0 },
        { child_id: 2, move_token: "lB", parent_id: 0 },
      ],
      nodes: [
        { ...neighborhoodResponse.nodes[0], child_count: 2 },
        neighborhoodResponse.nodes[1],
        { child_count: 0, id: 2, interval_end: 7, interval_start: 6, move_token: "lB", parent_id: 0, ply: 1 },
      ],
      overlays: {
        ...neighborhoodResponse.overlays,
        "2": { actual_ending_count: 1, results: { resigned: 1 }, sole_game_ordinal: 6, support: 1 },
      },
    });
    let resolveGame: (() => void) | undefined;
    mocks.games.mockImplementation((_version: string, nodeId: number) => new Promise((resolve) => {
      resolveGame = () => resolve({
        actual_ending_count: 1,
        dataset_version: "dataset-1",
        games: nodeId === 2 ? [{
          actual_ending: true,
          black_rating: 2100,
          black_result: "resigned",
          black_username: "Bob",
          ordinal: 6,
          provenance_flags: [],
          source: "chess.com",
          url: "https://www.chess.com/game/live/456",
          uuid: "game-2",
          white_rating: 2200,
          white_result: "win",
          white_username: "Alice",
        }] : [],
        limit: 1,
        node_id: nodeId,
        total_matching: nodeId === 2 ? 1 : 0,
      });
    }));
    render(<OpeningExplorerPageClient />);

    await screen.findByLabelText("d4, loading source game");
    const choices = screen.getByLabelText("Candidate move choices");
    expect(within(choices).getAllByText("d4")).toHaveLength(1);
    expect(within(choices).queryByRole("button", { name: /d4, 1 games/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /e4, 6 games/i })).toHaveAttribute("aria-current", "true"));
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => resolveGame?.());
    const gameLink = await screen.findByRole("link", { name: /d4.*Alice.*1–0.*Bob/i });
    expect(gameLink).toHaveAttribute("href", "https://bughouse.aronteh.com/?gameId=456");
    expect(gameLink).toHaveAttribute("target", "_blank");
    expect(within(choices).getAllByText("d4")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /d4, 1 games/i })).not.toBeInTheDocument();
    expect(gameLink).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: /e4, 6 games/i })).toHaveAttribute("aria-current", "true");
    fireEvent.mouseEnter(gameLink);
    expect(gameLink).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /e4, 6 games/i })).toBeInTheDocument();
    expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("8/8/8/8");
    expect(mocks.games).toHaveBeenCalledWith(
      "dataset-1",
      2,
      { white: null, black: null },
      1,
      expect.any(AbortSignal),
    );
  });

  it("selects continuations with arrow keys and navigates forward and back through the cached path", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      edges: [
        { child_id: 2, move_token: "lB", parent_id: 0 },
        { child_id: 1, move_token: "mC", parent_id: 0 },
      ],
      nodes: [
        neighborhoodResponse.nodes[0],
        neighborhoodResponse.nodes[1],
        { child_count: 0, id: 2, interval_end: 7, interval_start: 6, move_token: "lB", parent_id: 0, ply: 1 },
      ],
      overlays: {
        ...neighborhoodResponse.overlays,
        "1": { actual_ending_count: 0, results: { win: 6 }, sole_game_ordinal: null, support: 6 },
        "2": { actual_ending_count: 0, results: { resigned: 2 }, sole_game_ordinal: null, support: 2 },
      },
    });

    render(<OpeningExplorerPageClient />);

    const e4 = await screen.findByRole("button", { name: /e4, 6 games/i });
    const d4 = screen.getByRole("button", { name: /d4, 2 games/i });
    await waitFor(() => expect(e4).toHaveAttribute("aria-current", "true"));

    expect(fireEvent.keyDown(window, { key: "ArrowDown" })).toBe(false);
    await waitFor(() => expect(d4).toHaveAttribute("aria-current", "true"));
    expect(fireEvent.keyDown(window, { key: "ArrowUp" })).toBe(false);
    await waitFor(() => expect(e4).toHaveAttribute("aria-current", "true"));
    expect(fireEvent.keyDown(window, { key: "ArrowDown" })).toBe(false);
    await waitFor(() => expect(d4).toHaveAttribute("aria-current", "true"));

    expect(fireEvent.keyDown(screen.getByLabelText("Player"), { key: "ArrowUp" })).toBe(true);
    expect(d4).toHaveAttribute("aria-current", "true");

    expect(fireEvent.keyDown(window, { key: "ArrowRight" })).toBe(false);
    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("3P4"));
    expect(mocks.push).toHaveBeenLastCalledWith("/opening-explorer?node=2&state=2&dataset=dataset-1");

    expect(fireEvent.keyDown(window, { key: "ArrowLeft" })).toBe(false);
    await waitFor(() => expect(screen.getByText("No moves yet")).toBeInTheDocument());
    expect(mocks.push).toHaveBeenLastCalledWith("/opening-explorer?node=0&state=0&dataset=dataset-1");
    await waitFor(() => expect(screen.getByRole("button", { name: /d4, 2 games/i })).toHaveAttribute("aria-current", "true"));

    expect(fireEvent.keyDown(window, { key: "ArrowRight" })).toBe(false);
    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("3P4"));
  });

  it("keeps client history when a cycle returns to the same node and state", async () => {
    mocks.neighborhood.mockResolvedValue({
      anchor_node_id: 0,
      anchor_state_id: 0,
      dataset_version: "dataset-1",
      edge_overlays: {
        "10": { results: { win: 2 }, sole_game_ordinal: null, support: 2 },
        "11": { results: { win: 2 }, sole_game_ordinal: null, support: 2 },
      },
      edges: [
        { child_id: 1, child_state_id: 1, id: 10, move_label: "Nf3", move_token: "gv", parent_state_id: 0 },
        { child_id: 0, child_state_id: 0, id: 11, move_label: "Ng1", move_token: "MU", parent_state_id: 1 },
      ],
      filter: null,
      frontiers: [],
      instrumentation: {
        budget_exception: false,
        elapsed_microseconds: 1,
        encoded_bytes: 800,
        returned_edges: 2,
        returned_nodes: 2,
        returned_states: 2,
        visited_nodes: 2,
      },
      node_overlays: { "0": { support: 2 }, "1": { support: 2 } },
      nodes: [
        { id: 0, placement: START.split(" ")[0], support: 2 },
        { id: 1, placement: STATE_FENS[3].split(" ")[0], support: 2 },
      ],
      state_overlays: {
        "0": { actual_ending_count: 0, results: { win: 2 }, sole_game_ordinal: null, support: 2 },
        "1": { actual_ending_count: 0, results: { win: 2 }, sole_game_ordinal: null, support: 2 },
      },
      states: [
        { id: 0, node_id: 0, outgoing_count: 1, position_fen: START },
        { id: 1, node_id: 1, outgoing_count: 1, position_fen: STATE_FENS[3] },
      ],
      target_forward_depth: 5,
    });

    render(<OpeningExplorerPageClient />);

    fireEvent.click(await screen.findByRole("button", { name: /Nf3, 2 games/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Ng1, 2 games/i }));

    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain(START));
    expect(screen.getByRole("button", { name: "Go to position after Nf3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to position after Ng1" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("5N2"));
    expect(screen.queryByRole("button", { name: "Go to position after Ng1" })).not.toBeInTheDocument();
  });

  it("keeps complete ancestor move lists pinned through bounded-cache pressure", async () => {
    const rootResponse = {
      ...neighborhoodResponse,
      edges: [
        { child_id: 1, move_token: "mC", parent_id: 0 },
        { child_id: 2, move_token: "lB", parent_id: 0 },
        { child_id: 3, move_token: "gv", parent_id: 0 },
      ],
      nodes: [
        { ...neighborhoodResponse.nodes[0], child_count: 3 },
        { ...neighborhoodResponse.nodes[1], child_count: 1 },
        { child_count: 0, id: 2, interval_end: 7, interval_start: 6, move_token: "lB", parent_id: 0, ply: 1 },
        { child_count: 0, id: 3, interval_end: 8, interval_start: 7, move_token: "gv", parent_id: 0, ply: 1 },
      ],
      overlays: {
        ...neighborhoodResponse.overlays,
        "2": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 6, support: 1 },
        "3": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 7, support: 1 },
      },
    };
    const pressureNodes = Array.from({ length: 5_001 }, (_, offset) => ({
      child_count: 0,
      id: offset + 1,
      interval_end: offset + 2,
      interval_start: offset + 1,
      move_token: offset === 0 ? "mC" : null,
      parent_id: offset === 0 ? 0 : null,
      ply: offset === 0 ? 1 : 0,
    }));
    const pressureResponse = {
      ...neighborhoodResponse,
      anchor_node_id: 1,
      edges: [],
      nodes: pressureNodes,
      overlays: {
        "1": { actual_ending_count: 0, results: { win: 6 }, sole_game_ordinal: null, support: 6 },
      },
      path: [{ move_token: null, node_id: 0 }, { move_token: "mC", node_id: 1 }],
    };
    mocks.neighborhood.mockImplementation(({ nodeId }: { nodeId: number }) => Promise.resolve(
      nodeId === 1 ? pressureResponse : rootResponse,
    ));

    render(<OpeningExplorerPageClient />);

    fireEvent.click(await screen.findByRole("button", { name: /e4, 6 games/i }));
    await waitFor(() => expect(mocks.neighborhood.mock.calls.length).toBeGreaterThanOrEqual(2));
    const requestsBeforeBack = mocks.neighborhood.mock.calls.length;
    fireEvent.keyDown(window, { key: "ArrowLeft" });

    const choices = screen.getByLabelText("Candidate move choices");
    await waitFor(() => expect(within(choices).getByText("d4")).toBeInTheDocument());
    expect(within(choices).getByText("Nf3")).toBeInTheDocument();
    expect(mocks.neighborhood).toHaveBeenCalledTimes(requestsBeforeBack);
  });

  it("loads a missing filtered overlay when backtracking to a structurally cached ancestor", async () => {
    mocks.players.mockResolvedValue(["alice"]);
    const filteredChild = {
      ...neighborhoodResponse,
      anchor_node_id: 1,
      edges: [],
      filter: { white_username: "alice", black_username: null },
      nodes: [neighborhoodResponse.nodes[1]],
      overlays: {
        "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 2, support: 1 },
      },
      path: [{ move_token: null, node_id: 0 }, { move_token: "mC", node_id: 1 }],
    };
    const filteredRoot = {
      ...neighborhoodResponse,
      filter: { white_username: "alice", black_username: null },
      overlays: {
        "0": { actual_ending_count: 0, results: { win: 2 }, sole_game_ordinal: null, support: 2 },
        "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 2, support: 1 },
      },
    };
    mocks.neighborhood.mockImplementation((request: { nodeId: number; filter: { white?: string | null } }) => {
      if (request.filter?.white === "alice") {
        return Promise.resolve(request.nodeId === 1 ? filteredChild : filteredRoot);
      }
      return Promise.resolve(neighborhoodResponse);
    });

    render(<OpeningExplorerPageClient />);

    fireEvent.click(await screen.findByRole("button", { name: /e4, 6 games/i }));
    await choosePlayer("alice");
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply filter" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    await waitFor(() => expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 1,
      filter: { white: "alice", black: null },
    })));

    fireEvent.keyDown(window, { key: "ArrowLeft" });

    await waitFor(() => expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 0,
      filter: { white: "alice", black: null },
    })));
    await waitFor(() => expect(screen.getByText("2 games")).toBeInTheDocument());
  });

  it("summarizes each variation as White wins, draws, and Black wins", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      overlays: {
        ...neighborhoodResponse.overlays,
        "1": {
          actual_ending_count: 0,
          results: { repetition: 1, resigned: 2, win: 3 },
          sole_game_ordinal: null,
          support: 6,
        },
      },
    });

    render(<OpeningExplorerPageClient />);

    const moveList = await screen.findByRole("region", { name: "Opening Tree" });
    expect(within(moveList).getByText("6")).toBeInTheDocument();
    expect(within(moveList).getByRole("img", { name: "White wins 50%, draws 17%, Black wins 33%" })).toBeInTheDocument();
    expect(within(moveList).queryByText(/repetition|resigned/i)).not.toBeInTheDocument();
  });

  it("renders actual endings as an unclickable move row without a game inspector", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      overlays: {
        ...neighborhoodResponse.overlays,
        "0": {
          ...neighborhoodResponse.overlays["0"],
          actual_ending_count: 2,
        },
      },
    });

    render(<OpeningExplorerPageClient />);

    const moveList = await screen.findByRole("region", { name: "Opening Tree" });
    const ending = within(moveList).getByLabelText("2 games end at this position");
    expect(ending).toHaveTextContent("-");
    expect(ending).not.toHaveAttribute("role", "button");
    expect(ending).not.toHaveAttribute("href");
    expect(within(moveList).queryByText(/actual game ending/i)).not.toBeInTheDocument();
    expect(within(moveList).queryByRole("button", { name: "Inspect bounded game details" })).not.toBeInTheDocument();
  });

  it("opens a sole continuation's source link with ArrowRight without advancing the board", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      overlays: {
        "0": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
        "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
      },
    });
    mocks.games.mockResolvedValue({
      actual_ending_count: 0,
      dataset_version: "dataset-1",
      games: [{
        actual_ending: false,
        black_rating: 2100,
        black_result: "resigned",
        black_username: "Bob",
        ordinal: 0,
        provenance_flags: [],
        source: "chess.com",
        url: "https://www.chess.com/game/live/123",
        uuid: "game-1",
        white_rating: 2200,
        white_result: "win",
        white_username: "Alice",
      }],
      limit: 1,
      node_id: 0,
      total_matching: 1,
    });

    render(<OpeningExplorerPageClient />);

    const gameLink = await screen.findByRole("link", { name: /e4.*Alice.*1–0.*Bob/i });
    expect(gameLink).toHaveAttribute("href", "https://bughouse.aronteh.com/?gameId=123");
    expect(gameLink).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("button", { name: /e4, 1 games/i })).not.toBeInTheDocument();
    const click = vi.spyOn(gameLink, "click").mockImplementation(() => {});
    expect(fireEvent.keyDown(window, { key: "ArrowRight" })).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("single-opening-board").dataset.fen).toContain(START);
    expect(mocks.games).toHaveBeenCalledWith(
      "dataset-1",
      1,
      { white: null, black: null },
      1,
      expect.any(AbortSignal),
    );
  });

  it("keeps loading the filtered source game while a background neighborhood refill merges", async () => {
    mocks.players.mockResolvedValue(["alice"]);
    const filteredResponse = {
      ...neighborhoodResponse,
      filter: { white_username: "alice", black_username: null },
      frontiers: [{ has_more: true, node_id: 0, reason: "budget" as const }],
      overlays: {
        "0": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
        "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
      },
    };
    mocks.neighborhood.mockImplementation(({ filter }: { filter?: { white?: string | null } }) => (
      Promise.resolve(filter?.white === "alice" ? filteredResponse : neighborhoodResponse)
    ));

    let resolveGame: ((response: unknown) => void) | undefined;
    mocks.games.mockImplementation((
      _datasetVersion: string,
      _nodeId: number,
      _filter: unknown,
      _limit: number,
      signal: AbortSignal,
    ) => new Promise((resolve, reject) => {
      resolveGame = resolve;
      signal.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted", "AbortError"));
      }, { once: true });
    }));

    render(<OpeningExplorerPageClient />);

    await choosePlayer("alice");
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply filter" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    await waitFor(() => expect(mocks.games).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.neighborhood.mock.calls.length).toBeGreaterThanOrEqual(3));
    const choices = screen.getByLabelText("Candidate move choices");
    expect(within(choices).getAllByText("e4")).toHaveLength(1);
    expect(within(choices).queryByRole("button")).not.toBeInTheDocument();

    resolveGame?.({
      actual_ending_count: 0,
      dataset_version: "dataset-1",
      games: [{
        actual_ending: false,
        black_rating: 2100,
        black_result: "resigned",
        black_username: "Bob",
        ordinal: 0,
        provenance_flags: [],
        source: "chess.com",
        url: "https://www.chess.com/game/live/123",
        uuid: "game-1",
        white_rating: 2200,
        white_result: "win",
        white_username: "Alice",
      }],
      limit: 1,
      node_id: 0,
      total_matching: 1,
    });

    expect(await screen.findByRole("link", { name: /e4.*Alice.*1–0.*Bob/i })).toHaveAttribute(
      "href",
      "https://bughouse.aronteh.com/?gameId=123",
    );
    expect(screen.queryByText("Loading source game…")).not.toBeInTheDocument();
    expect(within(choices).getAllByText("e4")).toHaveLength(1);
    expect(within(choices).queryByRole("button")).not.toBeInTheDocument();
  });

  it("ends the loading state when a source game cannot be loaded", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      overlays: {
        "0": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
        "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
      },
    });
    mocks.games.mockRejectedValue(new Error("source lookup failed"));

    render(<OpeningExplorerPageClient />);

    expect(await screen.findByText("Source game could not be loaded.")).toBeInTheDocument();
    const choices = screen.getByLabelText("Candidate move choices");
    expect(within(choices).getAllByText("e4")).toHaveLength(1);
    expect(within(choices).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByText("Loading source game…")).not.toBeInTheDocument();
    expect(screen.queryByText("The opening artifact or response could not be read safely.")).not.toBeInTheDocument();
  });

  it("loads visible support-one source games serially", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      edges: [
        { child_id: 1, move_token: "mC", parent_id: 0 },
        { child_id: 2, move_token: "lB", parent_id: 0 },
      ],
      nodes: [
        { child_count: 2, id: 0, interval_end: 2, interval_start: 0, move_token: null, parent_id: null, ply: 0 },
        { child_count: 0, id: 1, interval_end: 1, interval_start: 0, move_token: "mC", parent_id: 0, ply: 1 },
        { child_count: 0, id: 2, interval_end: 2, interval_start: 1, move_token: "lB", parent_id: 0, ply: 1 },
      ],
      overlays: {
        "0": { actual_ending_count: 0, results: { win: 2 }, sole_game_ordinal: null, support: 2 },
        "1": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
        "2": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 1, support: 1 },
      },
    });
    let resolveFirst: ((response: unknown) => void) | undefined;
    mocks.games.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirst = resolve;
    }));
    mocks.games.mockResolvedValue({
      actual_ending_count: 0,
      dataset_version: "dataset-1",
      edge_id: 1,
      games: [],
      limit: 1,
      total_matching: 0,
    });

    render(<OpeningExplorerPageClient />);

    await waitFor(() => expect(mocks.games).toHaveBeenCalledTimes(1));
    expect(mocks.games.mock.calls[0]?.[1]).toBe(2);

    await act(async () => {
      resolveFirst?.({
        actual_ending_count: 0,
        dataset_version: "dataset-1",
        edge_id: 2,
        games: [],
        limit: 1,
        total_matching: 0,
      });
    });

    await waitFor(() => expect(mocks.games).toHaveBeenCalledTimes(2));
    expect(mocks.games.mock.calls[1]?.[1]).toBe(1);
  });

  it("renders a sole-game terminal as the ending row without loading a separate game card", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      edges: [],
      nodes: [
        { child_count: 0, id: 0, interval_end: 1, interval_start: 0, move_token: null, parent_id: null, ply: 0 },
      ],
      overlays: {
        "0": { actual_ending_count: 1, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
      },
    });
    render(<OpeningExplorerPageClient />);

    expect(await screen.findByLabelText("1 game ends at this position")).toHaveTextContent("-");
    expect(screen.queryByRole("region", { name: "Game at this leaf" })).not.toBeInTheDocument();
    expect(mocks.games).not.toHaveBeenCalled();
  });

  it("does not invent a source edge when a graph state has no continuation", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      edges: [],
      nodes: [
        { child_count: 0, id: 0, interval_end: 1, interval_start: 0, move_token: null, parent_id: null, ply: 0 },
      ],
      overlays: {
        "0": { actual_ending_count: 0, results: { win: 1 }, sole_game_ordinal: 0, support: 1 },
      },
    });
    mocks.games.mockResolvedValue({
      actual_ending_count: 0,
      dataset_version: "dataset-1",
      games: [{
        actual_ending: false,
        black_rating: 2100,
        black_result: "resigned",
        black_username: "Bob",
        ordinal: 0,
        provenance_flags: [],
        source: "chess.com",
        url: "https://www.chess.com/game/live/123",
        uuid: "game-1",
        white_rating: 2200,
        white_result: "win",
        white_username: "Alice",
      }],
      limit: 1,
      node_id: 0,
      total_matching: 1,
    });

    render(<OpeningExplorerPageClient />);

    await screen.findByText("No indexed continuations from this position.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("1 game")).toBeInTheDocument();
    expect(mocks.games).not.toHaveBeenCalled();
  });

  it("places the played move list between the board and the candidate-move controls", async () => {
    render(<OpeningExplorerPageClient />);

    const playedMoves = await screen.findByRole("complementary", { name: "Played moves" });
    const controls = screen.getByRole("complementary", { name: "Explorer controls" });
    const board = screen.getByRole("region", { name: "Opening board" });

    const moveList = within(playedMoves).getByRole("region", { name: "Move list" });
    expect(moveList).toHaveTextContent("No moves yet");
    expect(within(moveList).queryByText("Starting position")).not.toBeInTheDocument();
    expect(within(moveList).queryByRole("button", { name: "Go to starting position" })).not.toBeInTheDocument();
    expect(within(playedMoves).getByText("Prototype instrumentation")).toBeInTheDocument();
    expect(within(playedMoves).queryByRole("region", { name: "Opening Tree" })).not.toBeInTheDocument();
    expect(within(controls).getByText("Player filter")).toBeInTheDocument();
    expect(within(controls).getByRole("region", { name: "Opening Tree" })).toBeInTheDocument();
    expect(within(controls).queryByText("Prototype instrumentation")).not.toBeInTheDocument();
    // Position context belongs in the move list; the board pane should not repeat the last ply.
    expect(within(board).queryByRole("heading")).not.toBeInTheDocument();

    fireEvent.click(within(controls).getByRole("button", { name: /e4, 6 games/i }));
    expect(await within(playedMoves).findByRole("button", { name: "Go to position after e4" })).toBeInTheDocument();
    expect(within(board).queryByRole("heading")).not.toBeInTheDocument();
    expect(within(board).queryByText("e4")).not.toBeInTheDocument();
  });

  it("does not loop when an idle refill leaves the selected view on a frontier", async () => {
    mocks.neighborhood.mockResolvedValue({
      ...neighborhoodResponse,
      frontiers: [{ has_more: true, node_id: 0, reason: "budget" }],
    });

    render(<OpeningExplorerPageClient />);

    await waitFor(() => expect(mocks.neighborhood.mock.calls.length).toBeGreaterThanOrEqual(2));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    const settledRequestCount = mocks.neighborhood.mock.calls.length;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(mocks.neighborhood).toHaveBeenCalledTimes(settledRequestCount);
    expect(screen.getByText("Foreground neighborhood requests").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Prefetch neighborhood requests").nextElementSibling).toHaveTextContent("1");
  });
});
