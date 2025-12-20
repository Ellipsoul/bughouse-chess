"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Square } from "chess.js";
// Import CSS from the package
import "chessboardjs/www/css/chessboard.css";
import type { BughouseBoardId, BughousePieceType, BughouseSide } from "../types/analysis";
import {
  type ArrowKey,
  isSquare,
  toggleArrowInList,
  toggleSquareInList,
} from "../utils/boardAnnotations";

interface ChessBoardInstance {
  destroy: () => void;
  // `animated` mirrors chessboard.js docs: position(fen, useAnimation?)
  position: (fen: string, animated?: boolean) => void;
  /**
   * Set or get the board orientation.
   *
   * chessboard.js supports `orientation()` as a getter and `orientation(color)` as a setter.
   * We model both because we may want to query the current orientation in the future.
   */
  orientation: (color?: string) => void | string;
  /**
   * Toggle the board orientation.
   *
   * This is the method requested for user-driven flips so the library stays the
   * source of truth for the internal orientation state + any built-in behaviors.
   */
  flip: () => void;
  resize: () => void;
}

type ChessBoardFactory = (id: string, config: Record<string, unknown>) => ChessBoardInstance;

interface CustomWindow extends Window {
  $: unknown;
  jQuery: unknown;
  ChessBoard: ChessBoardFactory | undefined;
}

interface ChessBoardProps {
  fen?: string;
  boardName: BughouseBoardId;
  size?: number;
  flip?: boolean;
  promotedSquares?: string[];
  /**
   * Highlight the most recently played move (origin + destination squares).
   *
   * This is a persistent UI affordance: it should remain visible even when the user
   * is not actively interacting with the board (e.g. no dragging).
   *
   * - For normal moves, pass both `lastMoveFromSquare` and `lastMoveToSquare`.
   * - For bughouse drops, pass `lastMoveToSquare` and leave `lastMoveFromSquare` null.
   * - Pass nulls to clear the highlight (e.g. start position).
   */
  lastMoveFromSquare?: Square | null;
  lastMoveToSquare?: Square | null;
  /**
   * When dragging a piece on the board (not reserve drops), highlight legal destination squares.
   *
   * This is purely a UI affordance: it does not validate or apply moves.
   */
  dragLegalTargets?: Square[];
  /**
   * Optional source square for the current drag, used for stronger affordance.
   */
  dragSourceSquare?: Square | null;
  /**
   * When enabled, pieces are draggable and `onAttemptMove` is invoked via chessboard.js callbacks.
   */
  draggable?: boolean;
  /**
   * Called before a piece drag begins. Return `false` to prevent dragging.
   */
  onDragStart?: (payload: { board: BughouseBoardId; source: Square; piece: string }) => boolean;
  /**
   * Called when a piece drag interaction ends (drop, snapback, or no-op release).
   *
   * Note: chessboard.js does not expose a dedicated `onDragEnd` callback, so we invoke this
   * from `onDrop` for all end states we can observe.
   */
  onDragEnd?: (payload: { board: BughouseBoardId }) => void;
  /**
   * Called when the user drops a piece. Return `"snapback"` to reject the move.
   *
   * Note: promotions are handled at a higher layer (we snapback, show a modal, then
   * apply the promoted move which updates `fen` and re-renders the board).
   */
  onAttemptMove?: (payload: { board: BughouseBoardId; from: Square; to: Square; piece: string }) => "snapback" | void;
  /**
   * Optional square click handler (used for click-to-drop).
   */
  onSquareClick?: (payload: { board: BughouseBoardId; square: Square }) => void;
  /**
   * Optional reserve-drop handler (drag from reserves onto board square).
   * Return value mirrors chessboard.js: `"snapback"` rejects the drop.
   */
  onAttemptReserveDrop?: (payload: {
    board: BughouseBoardId;
    to: Square;
    side: BughouseSide;
    piece: BughousePieceType;
  }) => "snapback" | void;
  /**
   * When true, indicates a reserve piece is currently selected/armed for placement.
   * We use this to provide a global pointer cursor on the board for clearer affordance.
   */
  dropCursorActive?: boolean;
}

type PieceColor = "w" | "b";

type ViewBoxPoint = { x: number; y: number };

interface AnnotationGeometry {
  /**
   * ViewBox coordinates (0..100) of square centers.
   *
   * We store positions in viewBox space so the SVG can scale with the board
   * without needing per-pixel rerenders.
   */
  centers: Map<Square, ViewBoxPoint>;
  /**
   * Approx square size in viewBox units (0..100). Used for sizing circles/arrows.
   */
  squareSize: number;
  /**
   * Absolute positioning info (in px) so the SVG overlay matches the *actual* board element.
   *
   * We store this because chessboard.js may size/position `.board-b72b1` slightly differently
   * than our outer wrapper, and any mismatch causes increasing drift toward the bottom/right.
   */
  overlayPx: { left: number; top: number; width: number; height: number } | null;
}

/**
 * Parse a FEN string and map each square to the occupying piece color for styling.
 */
function buildSquareColorMap(fen?: string): Map<string, PieceColor> {
  const map = new Map<string, PieceColor>();
  if (!fen) return map;

  const parts = fen.split(" ");
  const board = parts[0];
  const rows = board.split("/");
  if (rows.length !== 8) return map;

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const rankStr = rows[rankIndex];
    let fileIndex = 0;

    for (const ch of rankStr) {
      if (fileIndex >= 8) break;
      if (/\d/.test(ch)) {
        fileIndex += parseInt(ch, 10);
        continue;
      }

      const square = `${files[fileIndex]}${8 - rankIndex}`;
      const color: PieceColor = ch === ch.toUpperCase() ? "w" : "b";
      map.set(square, color);
      fileIndex += 1;
    }
  }

  return map;
}

/**
 * Client-only wrapper around chessboard.js that keeps the board in sync with game state.
 */
export default function ChessBoard(
  {
    fen,
    boardName,
    size = 400,
    flip = false,
    promotedSquares = [],
    lastMoveFromSquare = null,
    lastMoveToSquare = null,
    dragLegalTargets = [],
    dragSourceSquare = null,
    draggable = false,
    onDragStart,
    onDragEnd,
    onAttemptMove,
    onSquareClick,
    onAttemptReserveDrop,
    dropCursorActive = false,
  }: ChessBoardProps,
) {
  const boardId = `board-${boardName}`;
  const boardRef = useRef<ChessBoardInstance | null>(null);
  const squareColorMap = useMemo(() => buildSquareColorMap(fen), [fen]);
  const desiredFlipRef = useRef(flip);
  const desiredFenRef = useRef(fen);
  const appliedFlipRef = useRef<boolean | null>(null);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onAttemptMoveRef = useRef(onAttemptMove);
  const onSquareClickRef = useRef(onSquareClick);
  const onAttemptReserveDropRef = useRef(onAttemptReserveDrop);

  /**
   * Per-board user annotations (circles/arrows).
   *
   * These are intentionally local to the board instance so that board A and board B
   * remain independent (standard bughouse UX).
   */
  const [circleSquares, setCircleSquares] = useState<Square[]>([]);
  const [arrowKeys, setArrowKeys] = useState<ArrowKey[]>([]);
  const circleSquaresRef = useRef(circleSquares);
  const arrowKeysRef = useRef(arrowKeys);
  const [annotationGeometry, setAnnotationGeometry] = useState<AnnotationGeometry | null>(null);

  useEffect(() => {
    circleSquaresRef.current = circleSquares;
  }, [circleSquares]);

  useEffect(() => {
    arrowKeysRef.current = arrowKeys;
  }, [arrowKeys]);

  const hasAnnotations = circleSquares.length > 0 || arrowKeys.length > 0;

  // Keep the latest desired values available to the async initializer.
  useEffect(() => {
    desiredFlipRef.current = flip;
  }, [flip]);

  useEffect(() => {
    desiredFenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
  }, [onDragStart]);

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  useEffect(() => {
    onAttemptMoveRef.current = onAttemptMove;
  }, [onAttemptMove]);

  useEffect(() => {
    onSquareClickRef.current = onSquareClick;
  }, [onSquareClick]);

  useEffect(() => {
    onAttemptReserveDropRef.current = onAttemptReserveDrop;
  }, [onAttemptReserveDrop]);

  useEffect(() => {
    // Dynamically load dependencies on the client side
    const initBoard = async () => {
      if (typeof window === "undefined") return;

      const customWindow = window as unknown as CustomWindow;

      // Load jQuery and attach to window
      const $ = (await import("jquery")).default;
      customWindow.$ = $;
      customWindow.jQuery = $;

      // Load Chessboard
      // Note: We need to ensure chessboardjs uses the global jQuery or we might need to handle it.
      // Since 'chessboardjs' is a CommonJS module that likely expects global $,
      // ensuring window.$ is set before import *might* work if we use require,
      // or if we import it after setting window.$.

      const ChessboardModule = await import("chessboardjs");
      const Chessboard = ((ChessboardModule as unknown as { default?: ChessBoardFactory }).default || customWindow.ChessBoard) as ChessBoardFactory | undefined;

      if (!Chessboard) {
        console.error("Chessboard.js failed to load");
        return;
      }

      const config: Record<string, unknown> = {
        position: desiredFenRef.current || "start",
        orientation: desiredFlipRef.current ? "black" : "white",
        pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
        showNotation: true,
        draggable,
        onDragStart: (source: string, piece: string) => {
          const handler = onDragStartRef.current;
          if (!handler) return true;
          return handler({ board: boardName, source: source as Square, piece });
        },
        onDrop: (source: string, target: string, piece: string) => {
          // Ensure any transient UI affordances (like legal-move highlights) are cleared.
          // We intentionally do this before returning so it runs on snapbacks and no-op drops too.
          onDragEndRef.current?.({ board: boardName });

          const handler = onAttemptMoveRef.current;
          if (!handler) return;
          // chessboard.js calls onDrop even when the user simply clicks a piece
          // without moving it (source === target). Treat that as a no-op.
          if (source === target) return;
          // Defensively reject non-square targets like "offboard"/"trash".
          if (!/^[a-h][1-8]$/.test(target)) return "snapback";
          return handler({
            board: boardName,
            from: source as Square,
            to: target as Square,
            piece,
          });
        },
      };

      if (boardRef.current) {
        boardRef.current.destroy();
      }

      boardRef.current = Chessboard(boardId, config);
      appliedFlipRef.current = desiredFlipRef.current;
    };

    initBoard();

    // Cleanup
    return () => {
      if (boardRef.current) {
        boardRef.current.destroy();
      }
    };
    // We only want to initialize once per board instance.
  }, [boardId, boardName, draggable]);

  const recomputeAnnotationGeometry = useCallback(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) {
      setAnnotationGeometry(null);
      return;
    }

    // chessboard.js renders the actual board as `.board-b72b1` inside our container.
    // Anchor geometry to that element so the overlay matches squares exactly.
    const boardCanvasEl =
      boardElement.querySelector(".board-b72b1") ?? boardElement;
    if (!(boardCanvasEl instanceof HTMLElement)) {
      setAnnotationGeometry(null);
      return;
    }

    const boardRect = boardCanvasEl.getBoundingClientRect();
    if (!Number.isFinite(boardRect.width) || !Number.isFinite(boardRect.height) || boardRect.width <= 0 || boardRect.height <= 0) {
      setAnnotationGeometry(null);
      return;
    }

    // Compute overlay placement relative to our wrapper (`<div class="relative" .../>`).
    const wrapperEl = boardElement.parentElement;
    const wrapperRect = wrapperEl?.getBoundingClientRect();
    const overlayPx =
      wrapperEl instanceof HTMLElement && wrapperRect
        ? {
            left: boardRect.left - wrapperRect.left,
            top: boardRect.top - wrapperRect.top,
            width: boardRect.width,
            height: boardRect.height,
          }
        : null;

    const involvedSquares = new Set<Square>();
    for (const sq of circleSquaresRef.current) involvedSquares.add(sq);
    for (const key of arrowKeysRef.current) {
      const [from, to] = key.split("->") as [string, string];
      if (isSquare(from)) involvedSquares.add(from);
      if (isSquare(to)) involvedSquares.add(to);
    }

    // If nothing is drawn, we still compute a square size (useful for future previews),
    // but keep centers empty.
    const centers = new Map<Square, ViewBoxPoint>();

    let squareSize = 0;
    // Scan a single square to estimate size, then look up involved squares.
    const anySquareEl = boardCanvasEl.querySelector("[data-square]");
    if (anySquareEl instanceof HTMLElement) {
      const r = anySquareEl.getBoundingClientRect();
      squareSize = (r.width / boardRect.width) * 100;
    }

    for (const sq of involvedSquares) {
      const el = boardCanvasEl.querySelector(`[data-square="${sq}"]`);
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      const cx = ((r.left + r.width / 2) - boardRect.left) / boardRect.width;
      const cy = ((r.top + r.height / 2) - boardRect.top) / boardRect.height;
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
      centers.set(sq, { x: cx * 100, y: cy * 100 });
    }

    setAnnotationGeometry({ centers, squareSize, overlayPx });
  }, [boardId]);

  // Recompute annotation geometry when the board layout may have changed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Two rAFs: wait for chessboard.js to paint, then for browser layout to settle.
    let id2: number | null = null;
    const id1 = window.requestAnimationFrame(() => {
      id2 = window.requestAnimationFrame(() => recomputeAnnotationGeometry());
    });
    return () => {
      window.cancelAnimationFrame(id1);
      if (id2 !== null) window.cancelAnimationFrame(id2);
    };
  }, [recomputeAnnotationGeometry, fen, flip, size, circleSquares, arrowKeys]);

  // Observe resizing to keep overlay aligned when the board is responsive.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    const observer = new ResizeObserver(() => recomputeAnnotationGeometry());
    observer.observe(boardElement);
    return () => observer.disconnect();
  }, [boardId, recomputeAnnotationGeometry]);

  /**
   * Convert a DOM event target into a square within this board, if any.
   */
  const getSquareFromEventTarget = useCallback(
    (target: EventTarget | null): Square | null => {
      const boardElement = document.getElementById(boardId);
      if (!boardElement) return null;
      if (!(target instanceof HTMLElement)) return null;
      const squareEl = target.closest("[data-square]");
      if (!(squareEl instanceof HTMLElement)) return null;
      if (!boardElement.contains(squareEl)) return null;
      const square = squareEl.getAttribute("data-square");
      if (!square || !isSquare(square)) return null;
      return square;
    },
    [boardId],
  );

  /**
   * Find the square under a given viewport coordinate, restricted to this board.
   */
  const getSquareFromClientPoint = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const boardElement = document.getElementById(boardId);
      if (!boardElement) return null;
      const el = document.elementFromPoint(clientX, clientY);
      if (!(el instanceof HTMLElement)) return null;
      const squareEl = el.closest("[data-square]");
      if (!(squareEl instanceof HTMLElement)) return null;
      if (!boardElement.contains(squareEl)) return null;
      const square = squareEl.getAttribute("data-square");
      if (!square || !isSquare(square)) return null;
      return square;
    },
    [boardId],
  );

  // Right-click/drag annotations. Stored in a ref so we can handle events without re-binding.
  const rightGestureRef = useRef<{
    active: boolean;
    startSquare: Square | null;
    pointerId: number | null;
  }>({ active: false, startSquare: null, pointerId: null });

  /**
   * Fallback: some environments may deliver `contextmenu` reliably even if pointer events
   * behave unexpectedly. We can toggle a circle on `contextmenu` as a backup, but we must
   * suppress it when we already handled the gesture via pointer events to avoid double-toggling.
   */
  const suppressContextMenuToggleUntilRef = useRef<number>(0);

  // Attach native listeners for context-click annotations.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    const onContextMenu = (e: MouseEvent) => {
      // Always disable the browser context menu on the board.
      e.preventDefault();

      // If we just handled a right-click via pointer events, do not also toggle here.
      if (Date.now() < suppressContextMenuToggleUntilRef.current) return;

      // Fallback behavior: treat a context menu event on a square as a circle toggle.
      const square = getSquareFromEventTarget(e.target);
      if (!square) return;
      setCircleSquares((prev) => toggleSquareInList(prev, square));
    };

    const cleanupGlobalPointerListeners = () => {
      window.removeEventListener("pointerup", onPointerUpCapture, true);
      window.removeEventListener("pointercancel", onPointerUpCapture, true);
    };

    const finishGesture = (endSquare: Square | null) => {
      const gesture = rightGestureRef.current;
      if (!gesture.active || !gesture.startSquare) return;
      const startSquare = gesture.startSquare;

      if (!endSquare) {
        // Released off-board: treat as no-op.
        return;
      }

      if (endSquare === startSquare) {
        setCircleSquares((prev) => toggleSquareInList(prev, endSquare));
        suppressContextMenuToggleUntilRef.current = Date.now() + 250;
        return;
      }

      setArrowKeys((prev) => toggleArrowInList(prev, startSquare, endSquare));
      suppressContextMenuToggleUntilRef.current = Date.now() + 250;
    };

    const onPointerUpCapture = (e: PointerEvent) => {
      const gesture = rightGestureRef.current;
      if (!gesture.active) return;

      // Only respond to the pointer that started the gesture.
      if (gesture.pointerId !== null && e.pointerId !== gesture.pointerId) return;

      const endSquare = getSquareFromClientPoint(e.clientX, e.clientY);
      finishGesture(endSquare);

      rightGestureRef.current = { active: false, startSquare: null, pointerId: null };
      cleanupGlobalPointerListeners();

      try {
        if (gesture.pointerId !== null) boardElement.releasePointerCapture(gesture.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // Right click OR Ctrl+click (common macOS context-click).
      const isContextClick = e.button === 2 || (e.button === 0 && e.ctrlKey);
      if (!isContextClick) return;

      const startSquare = getSquareFromEventTarget(e.target);
      if (!startSquare) return;

      e.preventDefault();

      rightGestureRef.current = {
        active: true,
        startSquare,
        pointerId: e.pointerId,
      };

      try {
        boardElement.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      // Capture on window so we still complete if the pointer is released off-board.
      window.addEventListener("pointerup", onPointerUpCapture, true);
      window.addEventListener("pointercancel", onPointerUpCapture, true);
    };

    boardElement.addEventListener("contextmenu", onContextMenu);
    boardElement.addEventListener("pointerdown", onPointerDown);

    return () => {
      cleanupGlobalPointerListeners();
      boardElement.removeEventListener("contextmenu", onContextMenu);
      boardElement.removeEventListener("pointerdown", onPointerDown);
    };
  }, [boardId, getSquareFromClientPoint, getSquareFromEventTarget]);

  /**
   * Keep the rendered board synchronized with React state.
   *
   * Important: We intentionally use `board.flip()` (not `board.orientation(...)`) for
   * user-driven orientation toggles so we match the feature request and let chessboard.js
   * own its internal flip state.
   */
  useEffect(() => {
    if (boardRef.current) {
      if (fen) {
        // Disable chessboard.js animation to avoid duplicate-piece blink
        // per https://chessboardjs.com/docs#position.
        boardRef.current.position(fen, false);
      }

      // Flip only when the desired orientation toggles. This prevents accidental
      // double-flips when other props (like `fen` or `size`) update.
      if (appliedFlipRef.current === null) {
        // Board just initialized. Assume config orientation already applied.
        appliedFlipRef.current = flip;
      } else if (appliedFlipRef.current !== flip) {
        boardRef.current.flip();
        appliedFlipRef.current = flip;
      }

      boardRef.current.resize();
    }
  }, [fen, flip, size]);

  // Decorate promoted pieces with a subtle outline so they are visually distinct.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    // Clear old markers
    const existing = boardElement.querySelectorAll(".bh-promoted-square");
    existing.forEach((el) => {
      el.classList.remove("bh-promoted-square");
      el.classList.remove("bh-promoted-square--white");
      el.classList.remove("bh-promoted-square--black");
    });

    // Apply markers for current promoted squares
    promotedSquares.forEach((square) => {
      const squareEl = boardElement.querySelector(`[data-square="${square}"]`);
      if (squareEl instanceof HTMLElement) {
        const color = squareColorMap.get(square);
        squareEl.classList.add("bh-promoted-square");
        if (color === "w") {
          squareEl.classList.add("bh-promoted-square--white");
        } else if (color === "b") {
          squareEl.classList.add("bh-promoted-square--black");
        }
      }
    });
  }, [boardId, promotedSquares, squareColorMap]);

  // Provide a pointer cursor on the board when a reserve piece is armed.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;
    if (dropCursorActive) {
      boardElement.classList.add("bh-drop-cursor-active");
    } else {
      boardElement.classList.remove("bh-drop-cursor-active");
    }
  }, [boardId, dropCursorActive]);

  // Highlight legal target squares while dragging a piece on the board (not reserve drops).
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    // Clear previous highlights (both target squares and the drag source).
    boardElement.querySelectorAll(".bh-legal-target-square").forEach((el) => {
      el.classList.remove("bh-legal-target-square");
    });
    boardElement.querySelectorAll(".bh-legal-source-square").forEach((el) => {
      el.classList.remove("bh-legal-source-square");
    });

    if (dragSourceSquare) {
      const sourceEl = boardElement.querySelector(`[data-square="${dragSourceSquare}"]`);
      if (sourceEl instanceof HTMLElement) {
        sourceEl.classList.add("bh-legal-source-square");
      }
    }

    for (const square of dragLegalTargets) {
      const squareEl = boardElement.querySelector(`[data-square="${square}"]`);
      if (squareEl instanceof HTMLElement) {
        squareEl.classList.add("bh-legal-target-square");
      }
    }
  }, [boardId, dragLegalTargets, dragSourceSquare]);

  // Highlight the last played move (origin + destination squares) persistently.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    // Clear previous highlight.
    boardElement.querySelectorAll(".bh-last-move-from-square").forEach((el) => {
      el.classList.remove("bh-last-move-from-square");
    });
    boardElement.querySelectorAll(".bh-last-move-to-square").forEach((el) => {
      el.classList.remove("bh-last-move-to-square");
    });

    if (lastMoveFromSquare) {
      const fromEl = boardElement.querySelector(`[data-square="${lastMoveFromSquare}"]`);
      if (fromEl instanceof HTMLElement) {
        fromEl.classList.add("bh-last-move-from-square");
      }
    }

    if (lastMoveToSquare) {
      const toEl = boardElement.querySelector(`[data-square="${lastMoveToSquare}"]`);
      if (toEl instanceof HTMLElement) {
        toEl.classList.add("bh-last-move-to-square");
      }
    }
  }, [boardId, lastMoveFromSquare, lastMoveToSquare, fen, flip]);

  // Left click on a board that has drawings clears drawings and consumes the click.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    const onClickCapture = (event: MouseEvent) => {
      if (event.button !== 0) return;

      const hasAny =
        circleSquaresRef.current.length > 0 || arrowKeysRef.current.length > 0;
      if (!hasAny) return;

      // Clear per UX decision: consume click so click-to-drop doesn't fire.
      setCircleSquares([]);
      setArrowKeys([]);
      event.preventDefault();
      event.stopPropagation();
    };

    boardElement.addEventListener("click", onClickCapture, true);
    return () => boardElement.removeEventListener("click", onClickCapture, true);
  }, [boardId]);

  const previousFenForAnnotationsRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Ignore the initial load phase where `fen` may be undefined until data arrives.
    if (previousFenForAnnotationsRef.current === undefined) {
      if (fen !== undefined) {
        previousFenForAnnotationsRef.current = fen;
      }
      return;
    }
    if (fen !== previousFenForAnnotationsRef.current) {
      previousFenForAnnotationsRef.current = fen;
      setCircleSquares([]);
      setArrowKeys([]);
    }
  }, [fen]);

  // Delegate square click handling (for click-to-drop).
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    const handler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const squareEl = target.closest("[data-square]");
      if (!(squareEl instanceof HTMLElement)) return;
      const square = squareEl.getAttribute("data-square");
      if (!square) return;
      const cb = onSquareClickRef.current;
      if (!cb) return;
      cb({ board: boardName, square: square as Square });
    };

    boardElement.addEventListener("click", handler);
    return () => boardElement.removeEventListener("click", handler);
  }, [boardId, boardName]);

  // Accept HTML5 drags from our reserve strip onto squares.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    let lastHoverSquareEl: HTMLElement | null = null;

    const clearHover = () => {
      if (lastHoverSquareEl) {
        lastHoverSquareEl.classList.remove("bh-drop-hover-square");
        lastHoverSquareEl = null;
      }
    };

    const getSquareElementFromEventTarget = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof HTMLElement)) return null;
      const squareEl = target.closest("[data-square]");
      return squareEl instanceof HTMLElement ? squareEl : null;
    };

    const isReserveDrag = (event: DragEvent): boolean => {
      const types = event.dataTransfer?.types;
      return Boolean(types && Array.from(types).includes("application/x-bughouse-reserve-piece"));
    };

    const onDragOver = (event: DragEvent) => {
      const handler = onAttemptReserveDropRef.current;
      if (!handler) return;
      if (!isReserveDrag(event)) return;
      const squareEl = getSquareElementFromEventTarget(event.target);
      if (!squareEl) return;

      // Allow drop.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

      if (lastHoverSquareEl !== squareEl) {
        clearHover();
        squareEl.classList.add("bh-drop-hover-square");
        lastHoverSquareEl = squareEl;
      }
    };

    const onDrop = (event: DragEvent) => {
      const handler = onAttemptReserveDropRef.current;
      if (!handler) return;
      if (!isReserveDrag(event)) return;
      const squareEl = getSquareElementFromEventTarget(event.target);
      if (!squareEl) return;
      const square = squareEl.getAttribute("data-square");
      if (!square || !/^[a-h][1-8]$/.test(square)) return;

      const raw = event.dataTransfer?.getData("application/x-bughouse-reserve-piece");
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { color?: BughouseSide; piece?: BughousePieceType };
        if (!parsed.color || !parsed.piece) return;
        event.preventDefault();
        clearHover();
        return handler({
          board: boardName,
          to: square as Square,
          side: parsed.color,
          piece: parsed.piece,
        });
      } catch {
        // ignore malformed drags
      }
    };

    const onDragLeave = (event: DragEvent) => {
      if (!isReserveDrag(event)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && boardElement.contains(related)) {
        // Still inside the board; dragleave fires when moving between child elements.
        return;
      }
      clearHover();
    };

    boardElement.addEventListener("dragover", onDragOver);
    boardElement.addEventListener("drop", onDrop);
    boardElement.addEventListener("dragleave", onDragLeave);
    return () => {
      boardElement.removeEventListener("dragover", onDragOver);
      boardElement.removeEventListener("drop", onDrop);
      boardElement.removeEventListener("dragleave", onDragLeave);
      clearHover();
    };
  }, [boardId, boardName]);

  const renderedCircles = useMemo(() => {
    if (!annotationGeometry) return [];
    /**
     * Visual tuning:
     * - Circle should sit comfortably inside the square (not touching edges).
     * - Stroke should be thin and readable at typical board sizes.
     */
    // Standard chess UIs use a big “ring” that fills most of the square.
    // Half-square in viewBox is ~squareSize/2, so stay slightly inside that.
    const r = Math.max(0, annotationGeometry.squareSize * 0.44);
    const strokeWidthPx = 2.5;
    return circleSquares
      .map((sq) => ({ sq, center: annotationGeometry.centers.get(sq) }))
      .filter((x): x is { sq: Square; center: ViewBoxPoint } => Boolean(x.center))
      .map(({ sq, center }) => (
        <circle
          key={`circle:${sq}`}
          cx={center.x}
          cy={center.y}
          r={r}
          className="bh-board-annotation-circle"
          vectorEffect="non-scaling-stroke"
          strokeWidth={strokeWidthPx}
        />
      ));
  }, [annotationGeometry, circleSquares]);

  const renderedArrows = useMemo(() => {
    if (!annotationGeometry) return [];
    const markerEnd = "url(#bh-arrowhead)";
    const strokeWidthPx = 3.25;
    // Keep arrows centered on squares. Avoid “drift” by not shortening endpoints aggressively.
    // We rely on the marker geometry (arrowhead extends backward from the end point).
    const inset = 0;

    const shorten = (from: ViewBoxPoint, to: ViewBoxPoint): { a: ViewBoxPoint; b: ViewBoxPoint } => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      if (!Number.isFinite(len) || len <= 0.001) return { a: from, b: to };
      const ux = dx / len;
      const uy = dy / len;
      return {
        a: { x: from.x + ux * inset, y: from.y + uy * inset },
        b: { x: to.x - ux * inset, y: to.y - uy * inset },
      };
    };

    return arrowKeys
      .map((key) => {
        const [from, to] = key.split("->") as [string, string];
        if (!isSquare(from) || !isSquare(to)) return null;
        const a = annotationGeometry.centers.get(from);
        const b = annotationGeometry.centers.get(to);
        if (!a || !b) return null;
        const { a: p1, b: p2 } = shorten(a, b);
        return (
          <line
            key={`arrow:${key}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            markerEnd={markerEnd}
            className="bh-board-annotation-arrow"
            vectorEffect="non-scaling-stroke"
            strokeWidth={strokeWidthPx}
          />
        );
      })
      .filter(Boolean);
  }, [annotationGeometry, arrowKeys]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size }}>
        <div id={boardId} style={{ width: "100%" }} />
        {hasAnnotations ? (
          <svg
            className="bh-board-annotation-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={
              annotationGeometry?.overlayPx
                ? {
                    left: annotationGeometry.overlayPx.left,
                    top: annotationGeometry.overlayPx.top,
                    width: annotationGeometry.overlayPx.width,
                    height: annotationGeometry.overlayPx.height,
                  }
                : undefined
            }
          >
            <defs>
              {/**
               * Arrowhead sizing:
               * - markerUnits=userSpaceOnUse so it scales with the SVG viewBox, not stroke width.
               * - size is derived from square size to keep it "chess UI standard".
               */}
              {(() => {
                const squareSize = annotationGeometry?.squareSize ?? 12.5;
                // A slightly larger head hides the line end cleanly and looks closer to common chess UIs.
                const headLength = Math.max(2, squareSize * 0.42);
                const headWidth = Math.max(1.8, squareSize * 0.32);
                /**
                 * Pull the line endpoint back *under* the arrowhead fill so anti-aliasing
                 * never reveals a tiny stroke segment past the tip.
                 *
                 * Note: `markerUnits="userSpaceOnUse"` means these values are in the SVG
                 * viewBox coordinate space (0..100), not px.
                 */
                const overlap = Math.max(1.2, squareSize * 0.14);
                const refX = Math.max(0, headLength - overlap);
                const refY = headWidth / 2;
                const d = `M0,0 L${headLength},${refY} L0,${headWidth} Z`;
                return (
                  <marker
                    id="bh-arrowhead"
                    markerUnits="userSpaceOnUse"
                    markerWidth={headLength}
                    markerHeight={headWidth}
                    refX={refX}
                    refY={refY}
                    orient="auto"
                  >
                    <path d={d} className="bh-board-annotation-arrowhead" />
                  </marker>
                );
              })()}
            </defs>
            {renderedArrows}
            {renderedCircles}
          </svg>
        ) : null}
      </div>
    </div>
  );
}

