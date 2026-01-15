import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowLeftRight } from "lucide-react";
import { BughouseMove } from "../../types/bughouse";
import { BughousePlayer } from "../../types/bughouse";
import {
  getBoardOrder,
  getMoveListColumnIndex,
  getPlayersForBoard,
} from "../../utils/boardOrderMapping";
import { APP_TOOLTIP_ID } from "../../utils/tooltips";

interface MoveListProps {
  moves: BughouseMove[];
  currentMoveIndex: number;
  /**
   * Optional per-move durations (deciseconds), aligned with `moves` indices.
   *
   * These durations are intended to represent **per-board move times**: the elapsed time since
   * the previous move on the same board as the move being displayed.
   */
  moveDurations?: number[];
  players: {
    aWhite: BughousePlayer;
    aBlack: BughousePlayer;
    bWhite: BughousePlayer;
    bBlack: BughousePlayer;
  };
  /**
   * Whether the logical boards are swapped left/right for display.
   */
  isBoardOrderSwapped?: boolean;
  /**
   * Called when the user toggles the left/right board order.
   */
  onToggleBoardOrder?: () => void;
  onMoveClick: (index: number) => void;
}

/**
 * Table-based move list showing interleaved bughouse moves with per-move timings.
 */
const MoveList: React.FC<MoveListProps> = ({
  moves,
  currentMoveIndex,
  moveDurations: providedMoveDurations,
  players,
  isBoardOrderSwapped = false,
  onToggleBoardOrder,
  onMoveClick,
}) => {
  const activeMoveRef = useRef<HTMLTableRowElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const { leftBoardId, rightBoardId } = getBoardOrder(isBoardOrderSwapped);
  const leftBoardPlayers = getPlayersForBoard(players, leftBoardId);
  const rightBoardPlayers = getPlayersForBoard(players, rightBoardId);
  const canToggleBoardOrder = Boolean(onToggleBoardOrder);

  // Pre-compute per-move durations (deciseconds) so we can show how long each move took.
  // If callers provide durations explicitly (recommended), we use those instead.
  const moveDurations = useMemo(() => {
    if (providedMoveDurations) return providedMoveDurations;
    const lastTimestampByBoard: Record<'A' | 'B', number> = { A: 0, B: 0 };

    return moves.map((move) => {
      const previous = lastTimestampByBoard[move.board] ?? 0;
      const current = Number.isFinite(move.timestamp) ? move.timestamp : previous;
      const duration = Math.max(0, current - previous);

      lastTimestampByBoard[move.board] = current;
      return duration;
    });
  }, [moves, providedMoveDurations]);

  const formatMoveTime = useCallback((deciseconds?: number) => {
    if (!Number.isFinite(deciseconds)) return "—";

    const safeValue = Math.max(0, Math.round(deciseconds ?? 0));
    const minutes = Math.floor(safeValue / 600);
    const seconds = Math.floor((safeValue % 600) / 10);
    const tenths = safeValue % 10;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
    }

    return `${(safeValue / 10).toFixed(1)}s`;
  }, []);

  const renderPlayerHeader = useCallback(
    (player: BughousePlayer) => {
      return (
        <div className="flex items-center justify-center gap-1 min-w-0">
          <span className="truncate min-w-0" title={player.username}>
            {player.username}
          </span>
        </div>
      );
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    const padding = 8;

    // Always handle "start of game" even if no active row (e.g., index -1).
    if (currentMoveIndex <= 0) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = activeMoveRef.current;
    if (!element) return;

    const elementTop = element.offsetTop; // relative to container
    const elementBottom = elementTop + element.offsetHeight;
    const viewTop = container.scrollTop + headerHeight + padding;
    const viewBottom = container.scrollTop + container.clientHeight - padding;

    if (elementTop < viewTop) {
      container.scrollTo({
        top: elementTop - headerHeight - padding,
        behavior: "smooth",
      });
    } else if (elementBottom > viewBottom) {
      container.scrollTo({
        top: elementBottom - container.clientHeight + padding,
        behavior: "smooth",
      });
    }
  }, [currentMoveIndex]);

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700 w-full">
      <div
        ref={containerRef}
        className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 relative"
      >
        <table className="w-full text-sm border-collapse table-fixed">
          <thead ref={headerRef} className="sticky top-0 z-10 shadow-md">
            {/* Row 1: Board Labels */}
            <tr className="h-7 text-[10px] uppercase tracking-wider font-medium relative">
              <th colSpan={2} className="bg-gray-200 text-gray-600 relative">
                Left Board
                {canToggleBoardOrder ? (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20">
                    <button
                      type="button"
                      onClick={onToggleBoardOrder}
                      aria-label="Swap left and right boards (s)"
                      aria-pressed={isBoardOrderSwapped}
                      data-testid="swap-board-order"
                      data-tooltip-id={APP_TOOLTIP_ID}
                      data-tooltip-content="Swap left and right boards (s)"
                      className={[
                        "inline-flex items-center justify-center rounded text-gray-700 transition-colors",
                        "h-5 w-5 bg-gray-300 hover:bg-gray-400",
                      ].join(" ")}
                    >
                      <ArrowLeftRight aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </th>
              <th colSpan={2} className="bg-gray-200 text-gray-600">
                Right Board
              </th>
            </tr>
            {/* Row 2: Player Names */}
            <tr className="h-7 text-[8px] font-semibold">
              <th className="bg-white text-black px-1 w-1/4">
                {renderPlayerHeader(leftBoardPlayers.white)}
              </th>
              <th className="bg-black text-white px-1 w-1/4">
                {renderPlayerHeader(leftBoardPlayers.black)}
              </th>
              <th className="bg-white text-black px-1 w-1/4">
                {renderPlayerHeader(rightBoardPlayers.white)}
              </th>
              <th className="bg-black text-white px-1 w-1/4">
                {renderPlayerHeader(rightBoardPlayers.black)}
              </th>
            </tr>
          </thead>
          <tbody>
            {moves.map((move, index) => {
              const isCurrent = index === currentMoveIndex;
              // Determine column index based on board and side
              // 0: A White, 1: A Black, 2: B White, 3: B Black
              const colIndex = getMoveListColumnIndex({
                boardId: move.board,
                side: move.side,
                isBoardOrderSwapped,
              });

              return (
                <tr
                  key={index}
                  ref={isCurrent ? activeMoveRef : null}
                  onClick={() => onMoveClick(index)}
                  className={`
                    cursor-pointer transition-colors border-b border-gray-700/30
                    ${isCurrent ? "bg-amber-200/15 hover:bg-amber-200/20" : "hover:bg-gray-700/50"}
                  `}
                >
                  {/* Left Board - White */}
                  <td
                    className={`
                      relative p-1 text-center h-8 border-r border-dashed border-gray-600/50
                      ${colIndex === 0 ? (isCurrent ? "text-amber-200 font-bold" : "text-gray-300") : ""}
                    `}
                  >
                    {colIndex === 0 ? (
                      <>
                        <span className="block leading-4">{move.move}</span>
                        <span
                          className="absolute bottom-0.5 right-1 text-[9px] text-gray-400 font-mono leading-none"
                          title={`Time since previous move on this board: ${formatMoveTime(moveDurations[index])}`}
                        >
                          {formatMoveTime(moveDurations[index])}
                        </span>
                      </>
                    ) : (
                      ""
                    )}
                  </td>
                  {/* Left Board - Black */}
                  <td
                    className={`
                      relative p-1 text-center h-8 border-r-4 border-gray-600/50
                      ${colIndex === 1 ? (isCurrent ? "text-amber-200 font-bold" : "text-gray-300") : ""}
                    `}
                  >
                    {colIndex === 1 ? (
                      <>
                        <span className="block leading-4">{move.move}</span>
                        <span
                          className="absolute bottom-0.5 right-1 text-[9px] text-gray-400 font-mono leading-none"
                          title={`Time since previous move on this board: ${formatMoveTime(moveDurations[index])}`}
                        >
                          {formatMoveTime(moveDurations[index])}
                        </span>
                      </>
                    ) : (
                      ""
                    )}
                  </td>
                  {/* Right Board - White */}
                  <td
                    className={`
                      relative p-1 text-center h-8 border-r border-dashed border-gray-600/50
                      ${colIndex === 2 ? (isCurrent ? "text-amber-200 font-bold" : "text-gray-300") : ""}
                    `}
                  >
                    {colIndex === 2 ? (
                      <>
                        <span className="block leading-4">{move.move}</span>
                        <span
                          className="absolute bottom-0.5 right-1 text-[9px] text-gray-400 font-mono leading-none"
                          title={`Time since previous move on this board: ${formatMoveTime(moveDurations[index])}`}
                        >
                          {formatMoveTime(moveDurations[index])}
                        </span>
                      </>
                    ) : (
                      ""
                    )}
                  </td>
                  {/* Right Board - Black */}
                  <td
                    className={`
                      relative p-1 text-center h-8
                      ${colIndex === 3 ? (isCurrent ? "text-amber-200 font-bold" : "text-gray-300") : ""}
                    `}
                  >
                    {colIndex === 3 ? (
                      <>
                        <span className="block leading-4">{move.move}</span>
                        <span
                          className="absolute bottom-0.5 right-1 text-[9px] text-gray-400 font-mono leading-none"
                          title={`Time since previous move on this board: ${formatMoveTime(moveDurations[index])}`}
                        >
                          {formatMoveTime(moveDurations[index])}
                        </span>
                      </>
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              );
            })}
             {/* Empty rows filler if needed, or just end */}
             {moves.length === 0 && (
                <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500 italic">No moves yet</td>
                </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MoveList;
