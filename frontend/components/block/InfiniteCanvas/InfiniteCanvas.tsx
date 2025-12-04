"use client";

import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import {
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import styled from "styled-components";
import {
  useGalleryFilter,
  FilterCategory,
} from "../../../shared/context/context";
import { InfiniteCanvasTile } from "./Tile";
import { ProjectType } from "@/shared/types/types";
import useMediaQuery from "../../../hooks/useMediaQuery";

gsap.registerPlugin(Observer);

// Base grid configuration (minimums)
// Desktop defaults
const DESKTOP_GRID_ROWS = 6;
const DESKTOP_GRID_COLS = 4;

// Mobile/Tablet defaults (Portrait < 768px)
const MOBILE_GRID_ROWS = 8; // More rows to cover vertical space
const MOBILE_GRID_COLS = 2; // Fewer columns for portrait

// How many vertical stacks of rows to render for seamless vertical panning.
// 2 stacks are usually sufficient to cover the viewport while panning and
// keep the DOM size smaller than 3 stacks.
const VERTICAL_STACKS = 2;

// Controls horizontal/vertical spacing in vw units so layout scales with viewport.
// Padding is half the gap for a uniform look at the block edges.
// Desktop
const DESKTOP_TILE_GAP_VW = 1;
// Mobile - slightly larger relative gap for touch targets if needed, or keep consistent
const MOBILE_TILE_GAP_VW = 2;

// Zoom configuration for the entire canvas when a tile is clicked.
// This scales the whole infinite canvas around the clicked tile.
const CANVAS_ZOOM = 3.5; // how much to magnify the canvas when clicked
const CANVAS_ZOOM_MOBILE = 1.5;
const CANVAS_ZOOM_DURATION = 1.25; // seconds
const INTERMEDIATE_CANVAS_ZOOM = 1.5;

// Staged zoom-out thresholds (approx px of user movement after zoom).
// After FIRST_ZOOM_OUT_THRESHOLD, zoom out to INTERMEDIATE_CANVAS_ZOOM.
// After SECOND_ZOOM_OUT_THRESHOLD, zoom out fully to 1.
const FIRST_ZOOM_OUT_THRESHOLD = 500;
const SECOND_ZOOM_OUT_THRESHOLD = 4000;

// How far the user can pan (in px of cumulative movement) before we clear the
// currently active tile. This is independent from zoom-out thresholds so we
// can keep tiles "latched" for shorter movements.
const ACTIVE_TILE_CLEAR_THRESHOLD = 200;

// Lower values make panning feel more sluggish (slower movement for the same input delta).
// Increase this if you want snappier / faster panning.
const PAN_SENSITIVITY = 0.4;

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

const InfiniteCanvasWrapper = styled.section`
  height: 100vh;
  width: 100%;
  overflow: hidden;
  cursor: default;
  /* Prevent native scrolling / pull-to-refresh gestures while dragging
     the canvas on touch devices. */
  touch-action: none;
  overscroll-behavior: none;
  overscroll-behavior-x: none; /* Explicitly prevent horizontal swipe-back on desktop trackpad */
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000;
  transform: translate3d(0, 0, 0);
  transform: translateZ(0);

  &.is-panning * {
    pointer-events: none;
  }

  &.is-dragging {
    cursor: grabbing;
  }

  &.is-dragging * {
    pointer-events: none;
  }
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

const Block = styled.div<{ $gap: string; $padding: string }>`
  display: flex;
  padding: ${(props) => props.$padding};
  gap: ${(props) => props.$gap};
`;

// Layer that we apply zoom (scale) to. Keeping this separate from the outer
// wrapper ensures that fixed-position UI like the header is not affected by
// the GSAP scale transform, especially on mobile browsers where transforms
// can change how fixed elements behave.
const ZoomLayer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  will-change: transform;
`;

type Props = {
  projects: ProjectType[];
};

const InfiniteCanvas = (props: Props) => {
  const { projects } = props;

  // Detect mobile/portrait breakpoint (matches standard tablets like iPad in portrait)
  const isMobile = useMediaQuery("(max-width: 768px)");

  const wrapperRef = useRef<HTMLElement | null>(null); // outer canvas wrapper (for classes)
  const zoomLayerRef = useRef<HTMLDivElement | null>(null); // zoom target
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasScaleRef = useRef<number>(1);
  const moveSinceZoomRef = useRef<number>(0);
  const zoomStageRef = useRef<0 | 1 | 2>(0); // 0 = no zoom, 1 = full zoom, 2 = intermediate zoom
  const isDraggingRef = useRef<boolean>(false);
  const [activeTileIndex, setActiveTileIndex] = useState<number | null>(null);

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

  // Mirror of activeTileIndex in a ref so we can read it safely inside GSAP
  // Observer callbacks without re-creating the observer on every render.
  const activeTileIndexRef = useRef<number | null>(null);

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

  // Derived styling constants based on device
  const tileGapVw = isMobile ? MOBILE_TILE_GAP_VW : DESKTOP_TILE_GAP_VW;
  const tileGap = `${tileGapVw}vw`;
  const tilePadding = `${tileGapVw / 2}vw`;

  // Calculate grid dimensions based on project count and device type.
  // Mobile: 2 cols, min 8 rows.
  // Desktop: 4 cols, min 5 rows.
  const { gridRows, gridCols, numberOfImages } = useMemo(() => {
    const totalProjects = projects?.length ?? 0;

    const baseRows = isMobile ? MOBILE_GRID_ROWS : DESKTOP_GRID_ROWS;
    const baseCols = isMobile ? MOBILE_GRID_COLS : DESKTOP_GRID_COLS;

    const minSlots = baseRows * baseCols;

    if (totalProjects <= minSlots) {
      return {
        gridRows: baseRows,
        gridCols: baseCols,
        numberOfImages: minSlots,
      };
    }

    // If more projects than slots, increase rows to fit all projects
    const neededRows = Math.ceil(totalProjects / baseCols);
    const finalRows = Math.max(baseRows, neededRows);

    return {
      gridRows: finalRows,
      gridCols: baseCols,
      numberOfImages: finalRows * baseCols,
    };
  }, [projects, isMobile]);

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
      const rowIndex = globalIndex % gridRows;
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

    const stackHeight = rowHeight * gridRows;
    const wrapWorldY = gsap.utils.wrap(-stackHeight, 0);
    const worldY = wrapWorldY(worldOffsetRef.current.y);

    blockWrapperRefs.current.forEach((wrapper, globalIndex) => {
      if (!wrapper) return;

      const stackIndex = Math.floor(globalIndex / gridRows);
      const rowIndex = globalIndex % gridRows;

      const baseY = stackIndex * stackHeight + rowIndex * rowHeight + worldY;

      gsap.set(wrapper, { y: baseY });
    });
  };

  const setActiveTile = (index: number | null) => {
    activeTileIndexRef.current = index;
    moveSinceActiveRef.current = 0;
    setActiveTileIndex(index);
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
  }, [gridRows, numberOfImages, isMobile]); // Re-measure when grid structure or mobile state changes

  const zoomOutCanvas = () => {
    if (!zoomLayerRef.current || canvasScaleRef.current === 1) return;

    canvasScaleRef.current = 1;
    moveSinceZoomRef.current = 0;
    zoomStageRef.current = 0;
    setActiveTile(null);

    gsap.to(zoomLayerRef.current, {
      scale: 1,
      transformOrigin: "50% 50%",
      duration: CANVAS_ZOOM_DURATION,
      ease: "power3.out",
    });
  };

  const handleTileClick = (event: MouseEvent<HTMLDivElement>) => {
    // Don't trigger click if user was dragging
    if (isDraggingRef.current) {
      return;
    }

    if (!zoomLayerRef.current) return;

    const wrapper = zoomLayerRef.current;
    const tile = event.currentTarget as HTMLDivElement;

    const tileRect = tile.getBoundingClientRect();

    const tileCenterX = tileRect.left + tileRect.width / 2;
    const tileCenterY = tileRect.top + tileRect.height / 2;

    // Center relative to the *visible* viewport. On mobile browsers, the
    // visual viewport can differ from window.innerHeight because of address
    // bars and browser chrome, so prefer visualViewport when available.
    const vv = window.visualViewport;
    const viewportCenterX = vv
      ? vv.width / 2 + vv.offsetLeft
      : window.innerWidth / 2;
    const viewportCenterY = vv
      ? vv.height / 2 + vv.offsetTop
      : window.innerHeight / 2;

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
    // Use the *current* viewport width to decide mobile vs desktop zoom instead
    // of relying on a React hook value that might lag orientation/device
    // changes (especially in dev tools).
    const vvForZoom = window.visualViewport;
    const viewportWidthForZoom = vvForZoom?.width ?? window.innerWidth;
    const isMobileViewportForZoom = viewportWidthForZoom <= 768;
    const targetZoom = isMobileViewportForZoom
      ? CANVAS_ZOOM_MOBILE
      : CANVAS_ZOOM;
    canvasScaleRef.current = targetZoom;
    moveSinceZoomRef.current = 0;
    zoomStageRef.current = 1;

    gsap.to(wrapper, {
      scale: targetZoom,
      transformOrigin: "50% 50%",
      duration: CANVAS_ZOOM_DURATION,
      ease: "power3.out",
    });
  };

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
        if (wrapperRef.current) {
          wrapperRef.current.classList.add("is-panning");
        }
      }

      if (panningTimeoutRef.current !== null) {
        window.clearTimeout(panningTimeoutRef.current);
      }

      // Small debounce so hover is disabled during inertial motion,
      // but quickly re-enabled once panning stops.
      panningTimeoutRef.current = window.setTimeout(() => {
        isPanningRef.current = false;
        if (wrapperRef.current) {
          wrapperRef.current.classList.remove("is-panning");
        }
        panningTimeoutRef.current = null;
      }, 120);
    };

    const observer = Observer.create({
      target: window,
      type: "wheel,touch,pointer",
      dragMinimum: DRAG_THRESHOLD, // Using our defined threshold (1px)

      onDragStart: () => {
        // This fires when a pointer/touch drag starts (not wheel)
        isDraggingRef.current = true;
        if (wrapperRef.current) {
          wrapperRef.current.classList.add("is-dragging");
        }
      },

      onDragEnd: () => {
        if (wrapperRef.current) {
          wrapperRef.current.classList.remove("is-dragging");
        }
        // Delay resetting isDraggingRef slightly so that any click event
        // firing immediately after mouseup can see that a drag just happened.
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      },

      onWheel: (self) => {
        // Prevent browser default behaviors (including swipe-back) on wheel/trackpad gestures
        if (self.event && self.event.preventDefault) {
          self.event.preventDefault();
        }
        // Explicitly handle wheel events to mark panning (pointer-events: none)
        // without triggering "is-dragging" (cursor: grabbing).
        markPanning();
      },

      onChangeX: (self) => {
        // Prevent browser swipe-back gesture on desktop trackpad when panning horizontally
        if (self.event && self.event.preventDefault) {
          self.event.preventDefault();
        }

        // markPanning acts as a general "activity" indicator for performance
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

            if (zoomLayerRef.current) {
              gsap.to(zoomLayerRef.current, {
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
        if (activeTileIndexRef.current !== null) {
          moveSinceActiveRef.current += distance;
          if (moveSinceActiveRef.current >= ACTIVE_TILE_CLEAR_THRESHOLD) {
            setActiveTile(null);
          }
        }
      },
      onChangeY: (self) => {
        // Prevent browser default behaviors when panning vertically
        if (self.event && self.event.preventDefault) {
          self.event.preventDefault();
        }

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

            if (zoomLayerRef.current) {
              gsap.to(zoomLayerRef.current, {
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
        if (activeTileIndexRef.current !== null) {
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
  }, [gridRows]);

  const handleTileClickWrapper = useCallback(
    (event: MouseEvent<HTMLDivElement>, tileIndex: number) => {
      const isActive = tileIndex === activeTileIndexRef.current;

      // If the same tile is clicked while zoomed in, clear active
      // state and zoom back out to the default level.
      if (isActive && canvasScaleRef.current > 1) {
        setActiveTile(null);
        zoomOutCanvas();
        return;
      }

      setActiveTile(tileIndex);
      handleTileClick(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const renderRowContent = (
    stackIndex: number,
    rowIndex: number,
    instanceIndex: number,
    blockRef?: (el: HTMLDivElement | null) => void
  ) => {
    const startIndex = rowIndex * gridCols;
    const endIndex = startIndex + gridCols;
    const rowTiles = tilesWithVisibility.slice(startIndex, endIndex);

    return (
      <Block
        aria-hidden={instanceIndex !== 0}
        ref={blockRef}
        $gap={tileGap}
        $padding={tilePadding}
      >
        {rowTiles.map((tile) => {
          const instanceId = `stack-${stackIndex}-inst-${instanceIndex}-row-${rowIndex}-${tile.index}`;
          const isActive = activeTileIndex === tile.index;

          return (
            <InfiniteCanvasTile
              key={instanceId}
              tileIndex={tile.index}
              index={tile.index}
              category={tile.category}
              aspectRatio={tile.aspectRatio}
              isVisible={tile.isVisible}
              isActive={isActive}
              media={tile.project?.media}
              title={tile.project?.title}
              aspectPadding={tile.aspectPadding}
              widthFactor={tile.widthFactor}
              onClick={handleTileClickWrapper}
              onMouseDown={() => {}}
              isMobile={isMobile}
            />
          );
        })}
      </Block>
    );
  };

  return (
    <InfiniteCanvasWrapper ref={wrapperRef}>
      <ZoomLayer ref={zoomLayerRef}>
        <InfiniteCanvasInner ref={containerRef}>
          {Array.from({ length: VERTICAL_STACKS }, (_, stackIndex) =>
            Array.from({ length: gridRows }, (_, rowIndex) => {
              const globalIndex = stackIndex * gridRows + rowIndex;

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
      </ZoomLayer>
    </InfiniteCanvasWrapper>
  );
};

export default InfiniteCanvas;
