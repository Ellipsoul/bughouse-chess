/** Browser-safe contracts for the transposition-aware opening graph. */

export interface DatasetMetadata {
  adapter_policy: string;
  coverage: { accepted_games: number; source_fingerprint: string };
  dataset_version: string;
  format_version: "packed-position-graph-v1" | "packed-position-graph-v2";
  /** Piece-placement node containing the standard initial board. */
  root_node_id: number;
  /** Rules-state occurrence used to begin navigation. */
  root_state_id: number;
  replay_policy: "strict-source-game-v1" | "skip-unreplayable-source-game-v1";
  terminal_policy:
    | "full-replay-game-end-v1"
    | "last-shared-placement-plus-one-or-game-end-v1";
}

export interface ExplorerFilter {
  white: string | null;
  black: string | null;
}

/** Canonical node identity. No ancestry or side-to-move lives here. */
export interface StructuralNode {
  id: number;
  placement: string;
  /** Unfiltered distinct-game support, useful for diagnostics only. */
  support: number;
}

/** Navigation context for one placement node. */
export interface StructuralState {
  id: number;
  node_id: number;
  /** Four-field FEN: placement, side, castling rights, en-passant target. */
  position_fen: string;
  outgoing_count: number;
}

/** A deterministic transition from one rules-state occurrence. */
export interface StructuralEdge {
  id: number;
  parent_state_id: number;
  child_id: number;
  child_state_id: number;
  move_token: string;
  /** Server-decoded display label; the browser never needs pre-move replay. */
  move_label: string;
}

export interface NodeOverlay {
  support: number;
}

export interface StateOverlay {
  actual_ending_count: number;
  results: Record<string, number>;
  sole_game_ordinal: number | null;
  support: number;
}

export interface EdgeOverlay {
  results: Record<string, number>;
  sole_game_ordinal: number | null;
  support: number;
}

export interface NeighborhoodResponse {
  anchor_node_id: number;
  anchor_state_id: number;
  dataset_version: string;
  edges: StructuralEdge[];
  filter: { white_username: string | null; black_username: string | null } | null;
  frontiers: Array<{
    has_more: boolean;
    node_id: number;
    state_id: number;
    reason: "budget" | "target_depth";
  }>;
  instrumentation: {
    budget_exception: boolean;
    elapsed_microseconds: number;
    encoded_bytes: number;
    returned_edges: number;
    returned_nodes: number;
    returned_states: number;
    visited_nodes: number;
  };
  node_overlays: Record<string, NodeOverlay>;
  nodes: StructuralNode[];
  state_overlays: Record<string, StateOverlay>;
  states: StructuralState[];
  edge_overlays: Record<string, EdgeOverlay>;
  target_forward_depth: number;
}

export interface GameExample {
  actual_ending: boolean;
  ordinal: number;
  uuid: string;
  url: string | null;
  white_username: string;
  black_username: string;
  white_rating: number | null;
  black_rating: number | null;
  white_result: string | null;
  black_result: string | null;
  source: string;
  provenance_flags: string[];
}

export interface GameExamplesResponse {
  actual_ending_count: number;
  dataset_version: string;
  edge_id: number;
  games: GameExample[];
  limit: number;
  total_matching: number;
}

export type ExplorerErrorCode =
  | "service_unavailable"
  | "stale_dataset_version"
  | "corrupt_response"
  | "invalid_request";
