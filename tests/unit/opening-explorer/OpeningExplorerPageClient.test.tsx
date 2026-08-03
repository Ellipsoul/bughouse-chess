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

    const moveList = await screen.findByRole("region", { name: "Move list" });
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
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /d4, 1 game/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Nf3, 1 game/i })).toBeInTheDocument();
    expect(mocks.neighborhood).toHaveBeenCalledTimes(requestsBeforeBack);
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

    const moveList = await screen.findByRole("region", { name: "Move list" });
    expect(within(moveList).getByText("6")).toBeInTheDocument();
    expect(within(moveList).getByRole("img", { name: "White wins 50%, draws 17%, Black wins 33%" })).toBeInTheDocument();
    expect(within(moveList).queryByText(/repetition|resigned/i)).not.toBeInTheDocument();
  });

  it("automatically shows both players and the Chess.com game link at a sole-game leaf", async () => {
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
    mocks.games.mockResolvedValue({
      actual_ending_count: 1,
      dataset_version: "dataset-1",
      games: [{
        actual_ending: true,
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

    const leaf = await screen.findByRole("region", { name: "Game at this leaf" });
    expect(within(leaf).getByText(/White\s+Alice/)).toBeInTheDocument();
    expect(within(leaf).getByText(/Black\s+Bob/)).toBeInTheDocument();
    expect(within(leaf).getByRole("link", { name: "Open full game on Chess.com" })).toHaveAttribute(
      "href",
      "https://www.chess.com/game/live/123",
    );
    expect(mocks.games).toHaveBeenCalledWith("dataset-1", 0, { white: null, black: null }, 1);
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
