import React, { useEffect, useRef } from "react";
import { BughouseMove } from "../types/bughouse";

interface MoveListProps {
  moves: BughouseMove[];
  currentMoveIndex: number;
  players: {
    aWhite: string;
    aBlack: string;
    bWhite: string;
    bBlack: string;
  };
  onMoveClick: (index: number) => void;
}

const MoveList: React.FC<MoveListProps> = ({
  moves,
  currentMoveIndex,
  players,
  onMoveClick,
}) => {
  const activeMoveRef = useRef<HTMLTableRowElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

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
            <tr className="h-7 text-[10px] uppercase tracking-wider font-medium">
              <th colSpan={2} className="bg-gray-200 text-gray-600 border-r-4 border-gray-600 border-b border-dotted border-gray-400">
                Left Board
              </th>
              <th colSpan={2} className="bg-gray-200 text-gray-600 border-b border-dotted border-gray-400">
                Right Board
              </th>
            </tr>
            {/* Row 2: Player Names */}
            <tr className="h-7 text-[10px] font-semibold">
              <th className="bg-white text-black px-1 border-r border-dashed border-gray-400 w-1/4">
                <div className="flex items-center justify-center">
                   <span className="truncate" title={players.aWhite}>{players.aWhite}</span>
                </div>
              </th>
              <th className="bg-black text-white px-1 border-r-4 border-gray-600 w-1/4">
                <div className="flex items-center justify-center">
                   <span className="truncate" title={players.aBlack}>{players.aBlack}</span>
                </div>
              </th>
              <th className="bg-white text-black px-1 border-r border-dashed border-gray-400 w-1/4">
                <div className="flex items-center justify-center">
                   <span className="truncate" title={players.bWhite}>{players.bWhite}</span>
                </div>
              </th>
              <th className="bg-black text-white px-1 w-1/4">
                <div className="flex items-center justify-center">
                   <span className="truncate" title={players.bBlack}>{players.bBlack}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {moves.map((move, index) => {
              const isCurrent = index === currentMoveIndex;
              // Determine column index based on board and side
              // 0: A White, 1: A Black, 2: B White, 3: B Black
              let colIndex = 0;
              if (move.board === 'A') {
                colIndex = move.side === 'white' ? 0 : 1;
              } else {
                colIndex = move.side === 'white' ? 2 : 3;
              }

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
                  {[0, 1, 2, 3].map((col) => {
                    let borderClass = "";
                    if (col === 0) borderClass = "border-r border-dashed border-gray-600/50";
                    else if (col === 1) borderClass = "border-r-4 border-gray-600/50";
                    else if (col === 2) borderClass = "border-r border-dashed border-gray-600/50";

                    return (
                      <td
                        key={col}
                        className={`
                          p-1 text-center h-8 w-1/4
                          ${col === colIndex ? (isCurrent ? "text-amber-200 font-bold" : "text-gray-300") : ""}
                          ${borderClass}
                        `}
                      >
                        {col === colIndex ? move.move : ""}
                      </td>
                    );
                  })}
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
