import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as actions from "../actions";

export interface SidebarProps {
  expanded: boolean;
  children: JSX.Element[] | JSX.Element;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 340;
const WIDTH_STORAGE_KEY = "tad.sidebarWidth";

const clampWidth = (w: number): number =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));

const loadWidth = (): number => {
  try {
    const saved = window.localStorage?.getItem(WIDTH_STORAGE_KEY);
    if (saved != null) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        return clampWidth(parsed);
      }
    }
  } catch (e) {
    // localStorage unavailable (or blocked); fall through to the default
  }
  return DEFAULT_WIDTH;
};

export const Sidebar: React.FC<SidebarProps> = ({ expanded, children }) => {
  const [width, setWidth] = useState(loadWidth);
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // While dragging, track the pointer on window so the drag survives the
  // cursor leaving the (narrow) handle.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    const handleMove = (e: MouseEvent) => {
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      setWidth(clampWidth(e.clientX - left));
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  // persist the width once the drag settles
  useEffect(() => {
    if (dragging) {
      return;
    }
    try {
      window.localStorage?.setItem(WIDTH_STORAGE_KEY, String(width));
    } catch (e) {
      // ignore: width just won't persist across sessions
    }
  }, [dragging, width]);

  const handleDoubleClick = useCallback(() => setWidth(DEFAULT_WIDTH), []);

  const expandClass = expanded ? "sidebar-expanded" : "sidebar-collapsed";
  const draggingClass = dragging ? " sidebar-dragging" : "";
  const style = expanded ? { width, minWidth: width } : undefined;
  return (
    <div
      ref={sidebarRef}
      className={"sidebar " + expandClass + draggingClass}
      style={style}
    >
      <div className="sidebar-content">
        <div className="sidebar-content-inner">{children}</div>
      </div>
      {expanded ? (
        <div
          className="sidebar-resize-handle"
          data-testid="sidebar-resize-handle"
          title="Drag to resize (double-click to reset)"
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={handleDoubleClick}
        />
      ) : null}
    </div>
  );
};
