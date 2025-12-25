import type { AnalysisNode } from "../../types/analysis";

/**
 * Find the "variation head" that contains `nodeId`.
 *
 * Definitions (matching how our analysis tree is modeled):
 * - Each node's `mainChildId` is the chosen continuation ("mainline") from that node.
 * - Any other child of a node is an alternative continuation ("variation") branching from it.
 * - A variation head is therefore a child node whose id !== parent.mainChildId.
 *
 * When the user right-clicks somewhere *inside* a variation (not necessarily its head),
 * we want actions like "Promote variation" to apply to the entire variation branch.
 * That means we must first map the clicked node back up to the nearest ancestor that is
 * a non-main child of its parent.
 *
 * @param nodesById - Analysis nodes keyed by node id
 * @param nodeId - Any node id within the tree
 * @returns The node id of the variation head containing `nodeId`, or `null` if `nodeId`
 *          is on the global mainline (i.e. it is never a non-main child of any ancestor).
 */
export function findContainingVariationHeadNodeId(
  nodesById: Record<string, AnalysisNode>,
  nodeId: string,
): string | null {
  let cursorId: string | null = nodeId;

  while (cursorId) {
    // TypeScript can struggle to infer the indexed access type here in some configs,
    // so we annotate explicitly to keep `tsc --noEmit` happy.
    const node: AnalysisNode | undefined = nodesById[cursorId];
    if (!node?.parentId) return null;

    const parent: AnalysisNode | undefined = nodesById[node.parentId];
    if (!parent) return null;

    // Defensive: if the tree is inconsistent, treat as not promotable.
    if (!parent.children.includes(cursorId)) return null;

    // If this node is not the parent's main child, it is the containing variation head.
    if (parent.mainChildId !== cursorId) return cursorId;

    // Otherwise, walk up the mainline and keep searching for the divergence point.
    cursorId = parent.id;
  }

  return null;
}
