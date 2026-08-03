export interface DatasetMetadata {
  adapter_policy: string;
  coverage: { accepted_games: number; source_fingerprint: string };
  dataset_version: string;
  format_version: string;
  root_node_id: number;
  terminal_policy: string;
}

export interface ExplorerFilter {
  white: string | null;
  black: string | null;
}

export interface StructuralNode {
  child_count: number;
  id: number;
  interval_end: number;
  interval_start: number;
  move_token: string | null;
  parent_id: number | null;
  ply: number;
}

export interface StructuralEdge {
  child_id: number;
  move_token: string;
  parent_id: number;
}

export interface NodeOverlay {
  actual_ending_count: number;
  results: Record<string, number>;
  sole_game_ordinal: number | null;
  support: number;
}

export interface NeighborhoodResponse {
  anchor_node_id: number;
  dataset_version: string;
  edges: StructuralEdge[];
  filter: { white_username: string | null; black_username: string | null } | null;
  frontiers: Array<{ has_more: boolean; node_id: number; reason: "budget" | "target_depth" }>;
  instrumentation: {
    budget_exception: boolean;
    elapsed_microseconds: number;
    encoded_bytes: number;
    returned_edges: number;
    returned_nodes: number;
    visited_nodes: number;
  };
  nodes: StructuralNode[];
  overlays: Record<string, NodeOverlay>;
  path: Array<{ move_token: string | null; node_id: number }>;
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
  games: GameExample[];
  limit: number;
  node_id: number;
  total_matching: number;
}

export type ExplorerErrorCode =
  | "service_unavailable"
  | "stale_dataset_version"
  | "corrupt_response"
  | "invalid_request";
