/**
 * Shared tooltip id for `react-tooltip`.
 *
 * Any element can opt into tooltips by providing:
 * - `data-tooltip-id={APP_TOOLTIP_ID}`
 * - `data-tooltip-content="..."`
 *
 * We intentionally centralize the id so the app uses *one* tooltip instance.
 */
export const APP_TOOLTIP_ID = "bh-tooltip";
