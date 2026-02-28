/**
 * Builds the tooltip text for a shared game/match description.
 *
 * The tooltip should:
 * - Trim whitespace.
 * - Return null when the description is empty.
 * - Prefix the text with "Description:" to clarify the meaning.
 */
export function getSharedGameDescriptionTooltip(description?: string | null): string | null {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) return null;

  return `Description: ${trimmed}`;
}
