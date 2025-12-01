"use client";

import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { MouseEvent, useEffect, useRef, useMemo, useState } from "react";
import styled from "styled-components";
import {
  useGalleryFilter,
  FilterCategory,
} from "../../../shared/context/context";
import { InfiniteCanvasTile } from "./Tile";

gsap.registerPlugin(Observer);

// Square grid configuration so horizontal and vertical wrapping behave the same
const GRID_SIZE = 7; // 7x7 grid of tiles per logical block

// How many vertical stacks of rows to render for seamless vertical panning
const VERTICAL_STACKS = 3;

// Controls horizontal/vertical spacing in vw units so layout scales with viewport.
// Padding is half the gap for a uniform look at the block edges.
const TILE_GAP_VW = 0.5; // visual gap between tiles (in vw)
const TILE_GAP = `${TILE_GAP_VW}vw`;
const TILE_PADDING = `${TILE_GAP_VW / 2}vw`; // padding is half the gap for a uniform look

// Zoom configuration for the entire canvas when a tile is clicked.
// This scales the whole infinite canvas around the clicked tile.
const CANVAS_ZOOM = 2; // how much to magnify the canvas when clicked
const CANVAS_ZOOM_DURATION = 1; // seconds
const INTERMEDIATE_CANVAS_ZOOM = 1.5;

// Staged zoom-out thresholds (approx px of user movement after zoom).
// After FIRST_ZOOM_OUT_THRESHOLD, zoom out to INTERMEDIATE_CANVAS_ZOOM.
// After SECOND_ZOOM_OUT_THRESHOLD, zoom out fully to 1.
const FIRST_ZOOM_OUT_THRESHOLD = 500;
const SECOND_ZOOM_OUT_THRESHOLD = 5000;

// Lower values make panning feel more sluggish (slower movement for the same input delta).
// Increase this if you want snappier / faster panning.
const PAN_SENSITIVITY = 0.5;

// Threshold in pixels to distinguish between a click and a drag
const DRAG_THRESHOLD = 5;

// Threshold in pixels of pan movement before we clear any hover state on tiles.
// This prevents tiny scroll/pan deltas from causing a visible "blink".
const HOVER_CLEAR_PAN_THRESHOLD = 5;

// Categories for testing - tiles will be assigned these categories in rotation
const TEST_CATEGORIES: FilterCategory[] = [
  "Photography",
  "Cinematography",
  "Direction",
];

const InfiniteCanvasWrapper = styled.section<{ $isDragging: boolean }>`
  height: 100vh;
  width: 100%;
  overflow: hidden;
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "default")};
`;

const InfiniteCanvasInner = styled.div`
  /* Container for all row wrappers; we position rows absolutely ourselves. */
  position: relative;
  width: 100%;
  height: 100%;
  will-change: transform;
`;

const BlockWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: row;
  will-change: transform;
`;

const Block = styled.div`
  display: flex;
  padding: ${TILE_PADDING};
  gap: ${TILE_GAP};
`;

const InfiniteCanvas = () => {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasScaleRef = useRef<number>(1);
  const moveSinceZoomRef = useRef<number>(0);
  const zoomStageRef = useRef<0 | 1 | 2>(0); // 0 = no zoom, 1 = full zoom, 2 = intermediate zoom
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);

  // Per-row horizontal / vertical infinite scrolling state
  const blockWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowBlockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowWidthsRef = useRef<number[]>([]);
  const rowHeightRef = useRef<number>(0);

  // Shared world-space offset for the infinite grid. All row positions are
  // derived from this and updated via GSAP for smooth motion.
  const worldOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverClearPanDeltaRef = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Incremental values for smooth quickTo animation (like the reference component)
  const incrXRef = useRef<number>(0);
  const incrYRef = useRef<number>(0);
  const xToRef = useRef<((value: number) => void) | null>(null);
  const yToRef = useRef<((value: number) => void) | null>(null);

  const { activeCategories } = useGalleryFilter();

  // GRID_SIZE x GRID_SIZE tiles to form a square block.
  const numberOfImages = GRID_SIZE * GRID_SIZE;

  type TileDescriptor = {
    index: number;
    category: FilterCategory;
    aspectRatio: string;
  };

  const ASPECT_RATIOS: string[] = ["1 / 1", "4 / 5", "5 / 4", "16 / 9"];

  // Assign categories to tiles for testing
  // Uses Math.random() for completely random assignment (generated once on mount)
  const tilesWithCategories = useMemo<TileDescriptor[]>(() => {
    return Array.from({ length: numberOfImages }, (_, index) => {
      const category = TEST_CATEGORIES[
        Math.floor(Math.random() * TEST_CATEGORIES.length)
      ] as FilterCategory;

      // Deterministic aspect ratio per index so all duplicates line up
      const aspectRatio =
        ASPECT_RATIOS[index % ASPECT_RATIOS.length] ?? ASPECT_RATIOS[0];

      return {
        index,
        category,
        aspectRatio,
      };
    });
    // Empty dependency array ensures this only runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine visibility for each tile based on active categories
  const tilesWithVisibility = useMemo(() => {
    const showAll =
      activeCategories.length === 0 || activeCategories.includes("All");

    return tilesWithCategories.map((tile) => {
      const isVisible = showAll || activeCategories.includes(tile.category);
      return {
        ...tile,
        isVisible,
      };
    });
  }, [tilesWithCategories, activeCategories]);

  // Update horizontal position of each row based on a shared world X offset.
  // This is called continuously by the quickTo animation
  const updateRowPositions = () => {
    const worldX = worldOffsetRef.current.x;

    blockWrapperRefs.current.forEach((wrapper, globalIndex) => {
      const rowIndex = globalIndex % GRID_SIZE;
      const rowWidth = rowWidthsRef.current[rowIndex];
      if (!wrapper || !rowWidth) return;

      // Wrap the row's offset between -rowWidth and 0 so three repeated blocks
      // create a seamless infinite horizontal strip.
      const wrapX = gsap.utils.wrap(-rowWidth, 0);
      const x = wrapX(worldX);

      gsap.set(wrapper, { x });
    });
  };

  // Update vertical position of each row based on a shared world Y offset.
  // This is called continuously by the quickTo animation
  const updateVerticalPositions = () => {
    const rowHeight = rowHeightRef.current;

    if (!rowHeight) return;

    const stackHeight = rowHeight * GRID_SIZE;
    const wrapWorldY = gsap.utils.wrap(-stackHeight, 0);
    const worldY = wrapWorldY(worldOffsetRef.current.y);

    blockWrapperRefs.current.forEach((wrapper, globalIndex) => {
      if (!wrapper) return;

      const stackIndex = Math.floor(globalIndex / GRID_SIZE);
      const rowIndex = globalIndex % GRID_SIZE;

      const baseY = stackIndex * stackHeight + rowIndex * rowHeight + worldY;

      gsap.set(wrapper, { y: baseY });
    });
  };

  // Measure each row's base block width (one pattern repeat per row).
  useEffect(() => {
    const updateRowWidths = () => {
      rowWidthsRef.current = rowBlockRefs.current.map((el) =>
        el ? el.getBoundingClientRect().width : 0
      );
      // All rows have the same height, so measure from the first wrapper.
      const firstWrapper = blockWrapperRefs.current[0];
      if (firstWrapper) {
        rowHeightRef.current = firstWrapper.getBoundingClientRect().height;
      }

      updateRowPositions();
      updateVerticalPositions();
    };

    updateRowWidths();
    window.addEventListener("resize", updateRowWidths);

    return () => {
      window.removeEventListener("resize", updateRowWidths);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomOutCanvas = () => {
    if (!wrapperRef.current || canvasScaleRef.current === 1) return;

    canvasScaleRef.current = 1;
    moveSinceZoomRef.current = 0;
    zoomStageRef.current = 0;
    setActiveTileId(null);

    gsap.to(wrapperRef.current, {
      scale: 1,
      transformOrigin: "50% 50%",
      duration: CANVAS_ZOOM_DURATION,
      ease: "power3.out",
    });
  };

  const handleTileMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    // Only handle left mouse button
    if (event.button !== 0) return;

    isDraggingRef.current = false;
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleTileClick = (event: MouseEvent<HTMLDivElement>) => {
    // Don't trigger click if user was dragging
    if (isDraggingRef.current || hasMovedRef.current) {
      return;
    }

    if (!wrapperRef.current) return;

    const wrapper = wrapperRef.current;
    const tile = event.currentTarget as HTMLDivElement;

    const tileRect = tile.getBoundingClientRect();

    const tileCenterX = tileRect.left + tileRect.width / 2;
    const tileCenterY = tileRect.top + tileRect.height / 2;

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    // First, pan so that the clicked tile is centered in the viewport.
    // When the wrapper is scaled, a given container translation results in
    // a larger movement on screen, so we need to compensate by dividing
    // by the current canvas scale.
    const currentScale =
      canvasScaleRef.current && canvasScaleRef.current > 0
        ? canvasScaleRef.current
        : 1;

    const deltaX = (viewportCenterX - tileCenterX) / currentScale;
    const deltaY = (viewportCenterY - tileCenterY) / currentScale;

    const targetWorldX = worldOffsetRef.current.x + deltaX;
    const targetWorldY = worldOffsetRef.current.y + deltaY;

    // Update incremental refs to match the target
    // Calculate the delta needed to reach target from current incremental position
    const deltaIncrX = targetWorldX - incrXRef.current;
    const deltaIncrY = targetWorldY - incrYRef.current;

    incrXRef.current += deltaIncrX;
    incrYRef.current += deltaIncrY;

    // Smoothly animate the "camera" so the clicked tile moves to center
    // Use quickTo for consistency with panning - it will smoothly animate to the target
    if (xToRef.current && yToRef.current) {
      xToRef.current(targetWorldX);
      yToRef.current(targetWorldY);
    } else {
      // Fallback to gsap.to if quickTo not initialized yet
      gsap.to(worldOffsetRef.current, {
        x: targetWorldX,
        y: targetWorldY,
        duration: CANVAS_ZOOM_DURATION,
        ease: "power3.out",
        onUpdate: () => {
          updateRowPositions();
          updateVerticalPositions();
        },
      });
    }

    // Then zoom the entire canvas (wrapper) around the viewport center.
    // Because the tile is already centered in the viewport, scaling around
    // the viewport center keeps that tile centered while everything grows.
    canvasScaleRef.current = CANVAS_ZOOM;
    moveSinceZoomRef.current = 0;
    zoomStageRef.current = 1;

    gsap.to(wrapper, {
      scale: CANVAS_ZOOM,
      transformOrigin: "50% 50%",
      duration: CANVAS_ZOOM_DURATION,
      ease: "power3.out",
    });
  };

  // Global mouse move handler to detect drag even when mouse leaves tile
  useEffect(() => {
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
      const deltaY = Math.abs(e.clientY - dragStartRef.current.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        hasMovedRef.current = true;
        setIsDragging(true);
      }
    };

    const handleGlobalMouseUp = () => {
      // Reset drag state after a short delay to allow click handler to check it
      setTimeout(() => {
        isDraggingRef.current = false;
        dragStartRef.current = null;
        hasMovedRef.current = false;
        setIsDragging(false);
      }, 0);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize quickTo functions for smooth continuous animation (like reference component)
    // quickTo animates the worldOffset smoothly with power4 easing
    const xTo = gsap.quickTo(worldOffsetRef.current, "x", {
      duration: 1.5,
      ease: "power4",
    });

    const yTo = gsap.quickTo(worldOffsetRef.current, "y", {
      duration: 1.5,
      ease: "power4",
    });

    xToRef.current = xTo;
    yToRef.current = yTo;

    // Use a ticker to continuously update row positions during smooth animation
    const ticker = gsap.ticker.add(() => {
      updateRowPositions();
      updateVerticalPositions();
    });

    const observer = Observer.create({
      target: window,
      type: "wheel,touch,pointer",
      onChangeX: (self) => {
        const delta =
          self.event.type === "wheel"
            ? -self.deltaX * PAN_SENSITIVITY
            : self.deltaX * 2 * PAN_SENSITIVITY;

        // Update incremental value and use quickTo for smooth animation
        incrXRef.current += delta;
        xTo(incrXRef.current);

        hoverClearPanDeltaRef.current.x += delta;

        // Track movement after zoom to trigger staged auto zoom-out.
        if (canvasScaleRef.current > 1) {
          const distance = Math.abs(self.deltaX);
          moveSinceZoomRef.current += distance;

          if (
            zoomStageRef.current === 1 &&
            moveSinceZoomRef.current >= FIRST_ZOOM_OUT_THRESHOLD
          ) {
            // First stage: zoom out a bit, but not fully.
            canvasScaleRef.current = INTERMEDIATE_CANVAS_ZOOM;
            zoomStageRef.current = 2;
            // Clear active tile when reaching first zoom out threshold
            setActiveTileId(null);

            if (wrapperRef.current) {
              gsap.to(wrapperRef.current, {
                scale: INTERMEDIATE_CANVAS_ZOOM,
                transformOrigin: "50% 50%",
                duration: CANVAS_ZOOM_DURATION,
                ease: "power3.out",
              });
            }
          } else if (
            zoomStageRef.current === 2 &&
            moveSinceZoomRef.current >= SECOND_ZOOM_OUT_THRESHOLD
          ) {
            // Second stage: zoom all the way back out.
            zoomOutCanvas();
          }
        }

        // Once the pan distance exceeds a small threshold, notify tiles once
        // to clear any stale hover state. This avoids a visible "blink" on
        // micro-movements while still unhovering tiles that truly pan away.
        const panDistSq =
          hoverClearPanDeltaRef.current.x * hoverClearPanDeltaRef.current.x +
          hoverClearPanDeltaRef.current.y * hoverClearPanDeltaRef.current.y;
        if (
          panDistSq >=
          HOVER_CLEAR_PAN_THRESHOLD * HOVER_CLEAR_PAN_THRESHOLD
        ) {
          window.dispatchEvent(new Event("infiniteCanvasPan"));
          hoverClearPanDeltaRef.current = { x: 0, y: 0 };
        }
      },
      onChangeY: (self) => {
        const delta =
          self.event.type === "wheel"
            ? -self.deltaY * PAN_SENSITIVITY
            : self.deltaY * 2 * PAN_SENSITIVITY;

        // Update incremental value and use quickTo for smooth animation
        incrYRef.current += delta;
        yTo(incrYRef.current);

        hoverClearPanDeltaRef.current.y += delta;

        // Track movement after zoom to trigger staged auto zoom-out.
        if (canvasScaleRef.current > 1) {
          const distance = Math.abs(self.deltaY);
          moveSinceZoomRef.current += distance;

          if (
            zoomStageRef.current === 1 &&
            moveSinceZoomRef.current >= FIRST_ZOOM_OUT_THRESHOLD
          ) {
            canvasScaleRef.current = INTERMEDIATE_CANVAS_ZOOM;
            zoomStageRef.current = 2;
            // Clear active tile when reaching first zoom out threshold
            setActiveTileId(null);

            if (wrapperRef.current) {
              gsap.to(wrapperRef.current, {
                scale: INTERMEDIATE_CANVAS_ZOOM,
                transformOrigin: "50% 50%",
                duration: CANVAS_ZOOM_DURATION,
                ease: "power3.out",
              });
            }
          } else if (
            zoomStageRef.current === 2 &&
            moveSinceZoomRef.current >= SECOND_ZOOM_OUT_THRESHOLD
          ) {
            zoomOutCanvas();
          }
        }

        const panDistSq =
          hoverClearPanDeltaRef.current.x * hoverClearPanDeltaRef.current.x +
          hoverClearPanDeltaRef.current.y * hoverClearPanDeltaRef.current.y;
        if (
          panDistSq >=
          HOVER_CLEAR_PAN_THRESHOLD * HOVER_CLEAR_PAN_THRESHOLD
        ) {
          window.dispatchEvent(new Event("infiniteCanvasPan"));
          hoverClearPanDeltaRef.current = { x: 0, y: 0 };
        }
      },
    });

    return () => {
      observer.kill();
      gsap.ticker.remove(ticker);
    };
  }, []);

  const renderRowContent = (
    stackIndex: number,
    rowIndex: number,
    instanceIndex: number,
    blockRef?: (el: HTMLDivElement | null) => void
  ) => {
    const startIndex = rowIndex * GRID_SIZE;
    const endIndex = startIndex + GRID_SIZE;
    const rowTiles = tilesWithVisibility.slice(startIndex, endIndex);

    return (
      <Block aria-hidden={instanceIndex !== 0} ref={blockRef}>
        {rowTiles.map((tile) => {
          const instanceId = `stack-${stackIndex}-inst-${instanceIndex}-row-${rowIndex}-${tile.index}`;
          const isActive = activeTileId === instanceId;

          return (
            <InfiniteCanvasTile
              key={instanceId}
              index={tile.index}
              category={tile.category}
              aspectRatio={tile.aspectRatio}
              isVisible={tile.isVisible}
              isDragging={isDragging}
              isActive={isActive}
              onClick={(event) => {
                // If the same tile is clicked while zoomed in, clear active
                // state and zoom back out to the default level.
                if (isActive && canvasScaleRef.current > 1) {
                  setActiveTileId(null);
                  zoomOutCanvas();
                  return;
                }

                setActiveTileId(instanceId);
                handleTileClick(event);
              }}
              onMouseDown={handleTileMouseDown}
            />
          );
        })}
      </Block>
    );
  };

  return (
    <InfiniteCanvasWrapper ref={wrapperRef} $isDragging={isDragging}>
      <InfiniteCanvasInner ref={containerRef}>
        {Array.from({ length: VERTICAL_STACKS }, (_, stackIndex) =>
          Array.from({ length: GRID_SIZE }, (_, rowIndex) => {
            const globalIndex = stackIndex * GRID_SIZE + rowIndex;

            return (
              <BlockWrapper
                key={`stack-${stackIndex}-row-${rowIndex}`}
                ref={(el) => {
                  blockWrapperRefs.current[globalIndex] = el;
                }}
              >
                {renderRowContent(
                  stackIndex,
                  rowIndex,
                  0,
                  stackIndex === 0
                    ? (el) => {
                        rowBlockRefs.current[rowIndex] = el;
                      }
                    : undefined
                )}
                {renderRowContent(stackIndex, rowIndex, 1)}
                {renderRowContent(stackIndex, rowIndex, 2)}
              </BlockWrapper>
            );
          })
        )}
      </InfiniteCanvasInner>
    </InfiniteCanvasWrapper>
  );
};

export default InfiniteCanvas;
