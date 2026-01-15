/**
 * Props for the CenteredLoadingSpinner component.
 */
export type CenteredLoadingSpinnerProps = {
  /**
   * Accessible, human-readable label for the loading state.
   */
  label?: string;
  /**
   * Optional additional classes to customize the container layout.
   */
  className?: string;
};

/**
 * Renders a centered, page-level loading spinner with accessible labeling.
 */
export default function CenteredLoadingSpinner({
  label = "Loading...",
  className = "",
}: CenteredLoadingSpinnerProps) {
  return (
    <div
      className={`flex min-h-screen w-full items-center justify-center ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-gray-300">
        <span className="sr-only">{label}</span>
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-400 border-t-transparent"
          aria-hidden="true"
        />
        <div className="text-sm">{label}</div>
      </div>
    </div>
  );
}
