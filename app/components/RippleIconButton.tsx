"use client";

import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type RippleIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactNode;
  /**
   * Human-friendly label for screen readers and tooltips.
   * If you pass an explicit `aria-label`, that will be used instead.
   */
  label: string;
  rippleColor?: string;
  rippleDurationMs?: number;
};

/**
 * Small, focused ripple button for icon-only controls. Handles mouse, touch,
 * and keyboard activation so the ripple fires consistently on Space/Enter.
 */
const RippleIconButton = forwardRef<HTMLButtonElement, RippleIconButtonProps>(
  (
    {
      icon,
      label,
      className = "",
      rippleColor = "rgba(96, 165, 250, 0.35)", // mariner-ish accent
      rippleDurationMs = 520,
      disabled,
      onPointerDown,
      onKeyDown,
      "aria-label": ariaLabel,
      ...rest
    },
    ref,
  ) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [ripples, setRipples] = useState<Ripple[]>([]);

    // Merge forwarded ref + internal ref.
    const setRefs = useCallback(
      (node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        if (!ref) return;
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      },
      [ref],
    );

    const clearRipple = useCallback((id: number) => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, []);

    const createRipple = useCallback(
      (clientX: number, clientY: number, isKeyboard = false) => {
        const node = buttonRef.current;
        if (!node) return;

        const rect = node.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.25;
        const x = isKeyboard ? rect.width / 2 : clientX - rect.left;
        const y = isKeyboard ? rect.height / 2 : clientY - rect.top;
        const id = Date.now() + Math.random();

        setRipples((prev) => [...prev, { id, x, y, size }]);
        window.setTimeout(() => clearRipple(id), rippleDurationMs);
      },
      [clearRipple, rippleDurationMs],
    );

    const handlePointerDown = useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!disabled) {
          createRipple(event.clientX, event.clientY, false);
        }
        onPointerDown?.(event);
      },
      [createRipple, disabled, onPointerDown],
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          createRipple(0, 0, true);
        }
        onKeyDown?.(event);
      },
      [createRipple, disabled, onKeyDown],
    );

    const rippleElements = useMemo(
      () =>
        ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="bh-ripple"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              backgroundColor: rippleColor,
              animationDuration: `${rippleDurationMs}ms`,
            }}
          />
        )),
      [ripples, rippleColor, rippleDurationMs],
    );

    return (
      <button
        {...rest}
        ref={setRefs}
        type="button"
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        className={`relative overflow-hidden focus-visible:outline-none ${className}`}
      >
        <span className="sr-only">{label}</span>
        <span aria-hidden>{icon}</span>
        {rippleElements}
      </button>
    );
  },
);

RippleIconButton.displayName = "RippleIconButton";

RippleIconButton.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
  rippleColor: PropTypes.string,
  rippleDurationMs: PropTypes.number,
  disabled: PropTypes.bool,
  onPointerDown: PropTypes.func,
  onKeyDown: PropTypes.func,
  "aria-label": PropTypes.string,
};

export default RippleIconButton;


