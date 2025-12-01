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
import { ProjectType } from "@/shared/types/types";

gsap.registerPlugin(Observer);

// Grid configuration. We keep at least 5 rows to comfortably cover the viewport
// vertically, but use fewer columns per row to keep the total tile count lean.
// This also makes it easy to "balance" a set of 20 projects across a 5x4 block.
const GRID_ROWS = 5; // vertical rows per block
const GRID_COLS = 4; // horizontal tiles per row

// How many vertical stacks of rows to render for seamless vertical panning.
// 2 stacks are usually sufficient to cover the viewport while panning and
// keep the DOM size smaller than 3 stacks.
const VERTICAL_STACKS = 2;

// Controls horizontal/vertical spacing in vw units so layout scales with viewport.
// Padding is half the gap for a uniform look at the block edges.
const TILE_GAP_VW = 1; // visual gap between tiles (in vw)
const TILE_GAP = `${TILE_GAP_VW}vw`;
const TILE_PADDING = `${TILE_GAP_VW / 2}vw`; // padding is half the gap for a uniform look

// Zoom configuration for the entire canvas when a tile is clicked.
// This scales the whole infinite canvas around the clicked tile.
const CANVAS_ZOOM = 3.5; // how much to magnify the canvas when clicked
const CANVAS_ZOOM_DURATION = 1; // seconds
const INTERMEDIATE_CANVAS_ZOOM = 1.5;

// Staged zoom-out thresholds (approx px of user movement after zoom).
// After FIRST_ZOOM_OUT_THRESHOLD, zoom out to INTERMEDIATE_CANVAS_ZOOM.
// After SECOND_ZOOM_OUT_THRESHOLD, zoom out fully to 1.
const FIRST_ZOOM_OUT_THRESHOLD = 500;
const SECOND_ZOOM_OUT_THRESHOLD = 5000;

// How far the user can pan (in px of cumulative movement) before we clear the
// currently active tile. This is independent from zoom-out thresholds so we
// can keep tiles "latched" for shorter movements.
const ACTIVE_TILE_CLEAR_THRESHOLD = 200;

// Lower values make panning feel more sluggish (slower movement for the same input delta).
// Increase this if you want snappier / faster panning.
const PAN_SENSITIVITY = 0.5;

// Threshold in pixels to distinguish between a click and a drag
const DRAG_THRESHOLD = 1;

// Categories derived from project.type
const mapProjectTypeToFilterCategory = (
  type: ProjectType["type"]
): FilterCategory => {
  switch (type) {
    case "photography":
      return "Photography";
    case "cinematography":
      return "Cinematography";
    case "direction":
      return "Direction";
    default:
      return "Photography";
  }
};

const InfiniteCanvasWrapper = styled.section<{ $isDragging: boolean }>`
  height: 100vh;
  width: 100%;
  overflow: hidden;
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "default")};
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000;
  transform: translate3d(0, 0, 0);
  transform: translateZ(0);
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

type Props = {
  projects: ProjectType[];
};

const InfiniteCanvas = (props: Props) => {
  const { projects } = props;

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
  const [isPanning, setIsPanning] = useState<boolean>(false);

  // Per-row horizontal / vertical infinite scrolling state
  const blockWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowBlockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowWidthsRef = useRef<number[]>([]);
  const rowHeightRef = useRef<number>(0);

  // Shared world-space offset for the infinite grid. All row positions are
  // derived from this and updated via GSAP for smooth motion.
  const worldOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track how far the user has panned since the current tile became active.
  // Used to clear the active state after enough movement (e.g. 500px).
  const moveSinceActiveRef = useRef<number>(0);

  // Mirror of activeTileId in a ref so we can read it safely inside GSAP
  // Observer callbacks without re-creating the observer on every render.
  const activeTileIdRef = useRef<string | null>(null);

  // Track current panning state in a ref so we only trigger React state
  // updates when the value actually changes, instead of on every wheel/pan
  // event. This reduces re-renders during continuous panning.
  const isPanningRef = useRef<boolean>(false);

  const panningTimeoutRef = useRef<number | null>(null);

  // Incremental values for smooth quickTo animation (like the reference component)
  const incrXRef = useRef<number>(0);
  const incrYRef = useRef<number>(0);
  const xToRef = useRef<((value: number) => void) | null>(null);
  const yToRef = useRef<((value: number) => void) | null>(null);

  const { activeCategories } = useGalleryFilter();

  // GRID_ROWS x GRID_COLS tiles to form one logical block pattern.
  const numberOfImages = GRID_ROWS * GRID_COLS;

  type TileDescriptor = {
    index: number;
    category: FilterCategory;
    aspectRatio: string;
    project?: ProjectType;
    aspectPadding?: string;
    widthFactor: number;
  };

  const ASPECT_RATIOS: string[] = ["1 / 1", "4 / 5", "5 / 4", "16 / 9"];

  const stableHash = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      const chr = value.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  };

  // Build tile descriptors from projects, repeating them to fill the grid.
  // Falls back to placeholder metadata if there are no projects.
  const tilesWithCategories = useMemo<TileDescriptor[]>(() => {
    if (projects && projects.length > 0) {
      // Deterministically "shuffle" projects based on their id so that
      // server and client renders match (avoiding hydration issues) while
      // still giving a pseudo-random distribution.
      const shuffledProjects = [...projects].sort((a, b) => {
        const ha = stableHash(a._id);
        const hb = stableHash(b._id);
        return ha - hb;
      });

      const baseTiles: Omit<TileDescriptor, "index">[] = shuffledProjects.map(
        (project) => {
          const category = mapProjectTypeToFilterCategory(project.type);

          // Prefer thumbnailImage dimensions for videos, otherwise fall back to main image.
          const imageSource =
            project.media?.thumbnailImage ?? project.media?.image;

          const dimensions =
            imageSource?.asset?.metadata?.dimensions ?? undefined;

          let aspectRatio: string = ASPECT_RATIOS[0];
          let aspectPadding: string | undefined;
          let widthFactor = 1;

          if (dimensions) {
            // Sanity's aspectRatio is width / height. Trust it when present.
            const ar =
              dimensions.aspectRatio && dimensions.aspectRatio > 0
                ? dimensions.aspectRatio
                : dimensions.width && dimensions.height
                  ? dimensions.width / dimensions.height
                  : undefined;

            if (ar && ar > 0) {
              widthFactor = ar; // width / height
              aspectRatio = `${ar} / 1`;
              // padding-top uses height / width * 100
              aspectPadding = `${(1 / ar) * 100}%`;
            }
          }

          return {
            category,
            aspectRatio,
            project,
            aspectPadding,
            widthFactor,
          };
        }
      );

      const tiles: TileDescriptor[] = [];

      for (let index = 0; index < numberOfImages; index += 1) {
        const source = baseTiles[index % baseTiles.length];
        tiles.push({
          index,
          category: source.category,
          aspectRatio: source.aspectRatio,
          project: source.project,
          aspectPadding: source.aspectPadding,
          widthFactor: source.widthFactor,
        });
      }

      return tiles;
    }

    // Placeholder behaviour if there are no projects
    return Array.from({ length: numberOfImages }, (_, index) => {
      const aspectRatio =
        ASPECT_RATIOS[index % ASPECT_RATIOS.length] ?? ASPECT_RATIOS[0];

      return {
        index,
        category: "Photography",
        aspectRatio,
        widthFactor: 1,
      };
    });
  }, [projects, numberOfImages]);

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
      const rowIndex = globalIndex % GRID_ROWS;
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

    const stackHeight = rowHeight * GRID_ROWS;
    const wrapWorldY = gsap.utils.wrap(-stackHeight, 0);
    const worldY = wrapWorldY(worldOffsetRef.current.y);

    blockWrapperRefs.current.forEach((wrapper, globalIndex) => {
      if (!wrapper) return;

      const stackIndex = Math.floor(globalIndex / GRID_ROWS);
      const rowIndex = globalIndex % GRID_ROWS;

      const baseY = stackIndex * stackHeight + rowIndex * rowHeight + worldY;

      gsap.set(wrapper, { y: baseY });
    });
  };

  const setActiveTile = (id: string | null) => {
    activeTileIdRef.current = id;
    moveSinceActiveRef.current = 0;
    setActiveTileId(id);
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
    setActiveTile(null);

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

    const markPanning = () => {
      // Only toggle React state when we actually change panning state to
      // avoid unnecessary re-renders during continuous wheel/drag events.
      if (!isPanningRef.current) {
        isPanningRef.current = true;
        setIsPanning(true);
      }

      if (panningTimeoutRef.current !== null) {
        window.clearTimeout(panningTimeoutRef.current);
      }

      // Small debounce so hover is disabled during inertial motion,
      // but quickly re-enabled once panning stops.
      panningTimeoutRef.current = window.setTimeout(() => {
        isPanningRef.current = false;
        setIsPanning(false);
        panningTimeoutRef.current = null;
      }, 120);
    };

    const observer = Observer.create({
      target: window,
      type: "wheel,touch,pointer",
      onChangeX: (self) => {
        markPanning();

        const delta =
          self.event.type === "wheel"
            ? -self.deltaX * PAN_SENSITIVITY
            : self.deltaX * 2 * PAN_SENSITIVITY;

        // Update incremental value and use quickTo for smooth animation
        incrXRef.current += delta;
        xTo(incrXRef.current);

        const distance = Math.abs(self.deltaX);

        // Track movement after zoom to trigger staged auto zoom-out.
        if (canvasScaleRef.current > 1) {
          moveSinceZoomRef.current += distance;

          if (
            zoomStageRef.current === 1 &&
            moveSinceZoomRef.current >= FIRST_ZOOM_OUT_THRESHOLD
          ) {
            // First stage: zoom out a bit, but not fully.
            canvasScaleRef.current = INTERMEDIATE_CANVAS_ZOOM;
            zoomStageRef.current = 2;
            // Clear active tile when reaching first zoom out threshold
            setActiveTile(null);

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

        // Clear active tile if the user has panned far enough since activation.
        // This is separate from zoom-out behaviour so a tile can stay visually
        // active/playing for small movements, but deactivate once the user
        // has clearly moved away.
        if (activeTileIdRef.current) {
          moveSinceActiveRef.current += distance;
          if (moveSinceActiveRef.current >= ACTIVE_TILE_CLEAR_THRESHOLD) {
            setActiveTile(null);
          }
        }
      },
      onChangeY: (self) => {
        markPanning();

        const delta =
          self.event.type === "wheel"
            ? -self.deltaY * PAN_SENSITIVITY
            : self.deltaY * 2 * PAN_SENSITIVITY;

        // Update incremental value and use quickTo for smooth animation
        incrYRef.current += delta;
        yTo(incrYRef.current);

        const distance = Math.abs(self.deltaY);

        // Track movement after zoom to trigger staged auto zoom-out.
        if (canvasScaleRef.current > 1) {
          moveSinceZoomRef.current += distance;

          if (
            zoomStageRef.current === 1 &&
            moveSinceZoomRef.current >= FIRST_ZOOM_OUT_THRESHOLD
          ) {
            canvasScaleRef.current = INTERMEDIATE_CANVAS_ZOOM;
            zoomStageRef.current = 2;
            // Clear active tile when reaching first zoom out threshold
            setActiveTile(null);

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

        // Clear active tile if the user has panned far enough since activation.
        if (activeTileIdRef.current) {
          moveSinceActiveRef.current += distance;
          if (moveSinceActiveRef.current >= ACTIVE_TILE_CLEAR_THRESHOLD) {
            setActiveTile(null);
          }
        }
      },
    });

    return () => {
      observer.kill();
      gsap.ticker.remove(ticker);

      if (panningTimeoutRef.current !== null) {
        window.clearTimeout(panningTimeoutRef.current);
        panningTimeoutRef.current = null;
      }
    };
  }, []);

  const renderRowContent = (
    stackIndex: number,
    rowIndex: number,
    instanceIndex: number,
    blockRef?: (el: HTMLDivElement | null) => void
  ) => {
    const startIndex = rowIndex * GRID_COLS;
    const endIndex = startIndex + GRID_COLS;
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
              isPanning={isPanning}
              isActive={isActive}
              media={tile.project?.media}
              title={tile.project?.title}
              aspectPadding={tile.aspectPadding}
              widthFactor={tile.widthFactor}
              onClick={(event) => {
                // If the same tile is clicked while zoomed in, clear active
                // state and zoom back out to the default level.
                if (isActive && canvasScaleRef.current > 1) {
                  setActiveTile(null);
                  zoomOutCanvas();
                  return;
                }

                setActiveTile(instanceId);
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
          Array.from({ length: GRID_ROWS }, (_, rowIndex) => {
            const globalIndex = stackIndex * GRID_ROWS + rowIndex;

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
