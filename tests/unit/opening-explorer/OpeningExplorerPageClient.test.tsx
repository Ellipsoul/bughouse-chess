import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  metadata: vi.fn(),
  neighborhood: vi.fn(),
  games: vi.fn(),
  players: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/components/board/ChessBoard", () => ({
  default: ({ fen }: { fen: string }) => <div data-testid="single-opening-board" data-fen={fen} />,
}));

vi.mock("@/app/components/opening-explorer/api", () => ({
  OpeningExplorerApiError: class extends Error {},
  OpeningExplorerApi: class {
    metadata = mocks.metadata;
    neighborhood = mocks.neighborhood;
    gameExamples = mocks.games;
    searchPlayers = mocks.players;
  },
}));

import OpeningExplorerPageClient from "@/app/components/opening-explorer/OpeningExplorerPageClient";

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

describe("OpeningExplorerPageClient", () => {
  beforeEach(() => {
    mocks.push.mockReset();
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

  it("renders one board and navigates an already-prefetched child without another request", async () => {
    render(<OpeningExplorerPageClient />);

    await screen.findByRole("heading", { name: "Opening explorer" });
    expect(screen.getByText("HOSTED EXPERIMENT")).toBeInTheDocument();
    expect(screen.getAllByTestId("single-opening-board")).toHaveLength(1);
    expect(mocks.neighborhood).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /e4/ }));

    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("4P3"));
    expect(mocks.neighborhood).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/opening-explorer?node=1&dataset=dataset-1");
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
    const moves = within(moveList).getAllByRole("button");
    expect(moves[0]).toHaveAccessibleName(/e4.*6 games/i);
    expect(moves[1]).toHaveAccessibleName(/d4.*1 game/i);
    expect(within(moveList).queryByText("mC")).not.toBeInTheDocument();
    expect(within(moveList).queryByText("lB")).not.toBeInTheDocument();
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
        "2": { actual_ending_count: 0, results: { resigned: 1 }, sole_game_ordinal: 6, support: 1 },
      },
    });

    render(<OpeningExplorerPageClient />);

    const e4 = await screen.findByRole("button", { name: /e4, 6 games/i });
    const d4 = screen.getByRole("button", { name: /d4, 1 game/i });
    await waitFor(() => expect(e4).toHaveAttribute("aria-current", "true"));

    expect(fireEvent.keyDown(window, { key: "ArrowDown" })).toBe(false);
    await waitFor(() => expect(d4).toHaveAttribute("aria-current", "true"));
    expect(fireEvent.keyDown(window, { key: "ArrowUp" })).toBe(false);
    await waitFor(() => expect(e4).toHaveAttribute("aria-current", "true"));
    expect(fireEvent.keyDown(window, { key: "ArrowDown" })).toBe(false);
    await waitFor(() => expect(d4).toHaveAttribute("aria-current", "true"));

    expect(fireEvent.keyDown(screen.getByLabelText("White"), { key: "ArrowUp" })).toBe(true);
    expect(d4).toHaveAttribute("aria-current", "true");

    expect(fireEvent.keyDown(window, { key: "ArrowRight" })).toBe(false);
    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("3P4"));
    expect(mocks.push).toHaveBeenLastCalledWith("/opening-explorer?node=2&dataset=dataset-1");

    expect(fireEvent.keyDown(window, { key: "ArrowLeft" })).toBe(false);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Starting position" })).toBeInTheDocument());
    expect(mocks.push).toHaveBeenLastCalledWith("/opening-explorer?node=0&dataset=dataset-1");
    await waitFor(() => expect(screen.getByRole("button", { name: /d4, 1 game/i })).toHaveAttribute("aria-current", "true"));

    expect(fireEvent.keyDown(window, { key: "ArrowRight" })).toBe(false);
    await waitFor(() => expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("3P4"));
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
    fireEvent.click(screen.getByRole("button", { name: "Go to starting position" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /d4, 1 game/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Nf3, 1 game/i })).toBeInTheDocument();
    expect(mocks.neighborhood).toHaveBeenCalledTimes(requestsBeforeBack);
  });

  it("loads a missing filtered overlay when backtracking to a structurally cached ancestor", async () => {
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
    fireEvent.change(screen.getByLabelText("White"), { target: { value: "alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filter" }));
    await waitFor(() => expect(mocks.neighborhood).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: 1,
      filter: { white: "alice", black: null },
    })));

    fireEvent.click(screen.getByRole("button", { name: "Go to starting position" }));

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

  it("opens the source game from a sole continuation without advancing the board", async () => {
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
    expect(gameLink).toHaveAttribute("href", "https://www.chess.com/game/live/123");
    expect(gameLink).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("button", { name: /e4/i })).not.toBeInTheDocument();
    expect(fireEvent.keyDown(window, { key: "ArrowRight" })).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByTestId("single-opening-board").dataset.fen).toContain("8/8/8/8");
    expect(mocks.games).toHaveBeenCalledWith(
      "dataset-1",
      0,
      { white: null, black: null },
      1,
      expect.any(AbortSignal),
    );
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

  it("keeps a source-game link when the packed terminal policy stops at support one", async () => {
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

    expect(await screen.findByRole("link", { name: /Source game.*Alice.*1–0.*Bob/i })).toHaveAttribute(
      "href",
      "https://www.chess.com/game/live/123",
    );
    expect(screen.getByText("1 game")).toBeInTheDocument();
    expect(screen.queryByText("No continuations from this position.")).not.toBeInTheDocument();
  });

  it("places the played move list between the board and the candidate-move controls", async () => {
    render(<OpeningExplorerPageClient />);

    const playedMoves = await screen.findByRole("complementary", { name: "Played moves" });
    const controls = screen.getByRole("complementary", { name: "Explorer controls" });

    expect(within(playedMoves).getByRole("region", { name: "Move list" })).toHaveTextContent("No moves played yet");
    expect(within(playedMoves).queryByRole("region", { name: "Opening Tree" })).not.toBeInTheDocument();
    expect(within(controls).getByText("Player filters")).toBeInTheDocument();
    expect(within(controls).getByRole("region", { name: "Opening Tree" })).toBeInTheDocument();
    expect(within(controls).getByText("Prototype instrumentation")).toBeInTheDocument();

    fireEvent.click(within(controls).getByRole("button", { name: /e4, 6 games/i }));
    expect(await within(playedMoves).findByRole("button", { name: "Go to position after e4" })).toBeInTheDocument();
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
