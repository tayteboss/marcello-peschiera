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

// Controls horizontal/vertical spacing in vw units so layout scales with viewport.
// Padding is half the gap for a uniform look at the block edges.
// Desktop
const DESKTOP_TILE_GAP_VW = 0.5;
const MOBILE_TILE_GAP_VW = 1;

// Zoom configuration for the entire canvas.
// We support three conceptual levels:
// - INTRO  (special one-off zoomed-out state while the loader is visible)
// - MIN    (furthest the user can zoom out during interaction)
// - DEFAULT (the "normal" viewing level)
// - MAX    (furthest the user can zoom in, e.g. when a tile is clicked)
//
// The current behaviour is that DEFAULT corresponds to 1 (no extra scaling).
// We allow zooming out slightly below this (MIN) and zooming in above this (MAX).
// INTRO can go beyond MIN so the opening move can feel more dramatic than what
// the user can reach later with the trackpad.
const CANVAS_ZOOM_DEFAULT = 1;
const CANVAS_ZOOM_MAX = 3;
const CANVAS_ZOOM_MIN = 0.7;

// Intro-only zoom (further out than MIN). Tweak these values to taste.
const CANVAS_ZOOM_INTRO = 0.4;

const CANVAS_ZOOM_DEFAULT_MOBILE = 1;
const CANVAS_ZOOM_MAX_MOBILE = 1.5;
const CANVAS_ZOOM_MIN_MOBILE = 0.7;
const CANVAS_ZOOM_INTRO_MOBILE = 0.5;

const CANVAS_ZOOM_DURATION = 1.25;
const INTERMEDIATE_CANVAS_ZOOM = 1.5;

// Staged zoom-out thresholds (approx px of user movement after zoom).
// After FIRST_ZOOM_OUT_THRESHOLD, zoom out to INTERMEDIATE_CANVAS_ZOOM.
// After SECOND_ZOOM_OUT_THRESHOLD, zoom out fully to 1.
const FIRST_ZOOM_OUT_THRESHOLD = 100;
const SECOND_ZOOM_OUT_THRESHOLD = 300;

// How far the user can pan (in px of cumulative movement) before we clear the
// currently active tile. This is independent from zoom-out thresholds so we
// can keep tiles "latched" for shorter movements.
const ACTIVE_TILE_CLEAR_THRESHOLD = 100;

// Minimum number of tiles we want to show on the canvas. If there are fewer
// projects than this, we'll deterministically repeat them until we reach this
// count so the canvas still feels substantial, but without infinite wrapping.
const MIN_PROJECTS_FOR_CANVAS = 100;

// Lower values make panning feel more sluggish (slower movement for the same input delta).
// Increase this if you want snappier / faster panning.
const PAN_SENSITIVITY = 1;

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
  touch-action: none;
  overscroll-behavior: none;
  overscroll-behavior-x: none; /* Explicitly prevent horizontal swipe-back on desktop trackpad */
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000;
  transform: translate3d(0, 0, 0);
  transform: translateZ(0);
  cursor: grab;

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
  position: relative;
  /* Size is determined by row content so we can derive canvas bounds. */
  display: flex;
  flex-direction: column;
  align-items: center;
  will-change: transform;
`;

const BlockWrapper = styled.div`
  display: flex;
  flex-direction: row;
  will-change: transform;
`;

const Block = styled.div<{ $gap: string; $padding: string }>`
  display: flex;
  justify-content: center;
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
  const dragDistanceRef = useRef<number>(0); // Track total drag distance
  const zoomBeforeDragRef = useRef<number>(1); // Store zoom level before drag starts
  const [activeTileIndex, setActiveTileIndex] = useState<number | null>(null);

  // Shared world-space offset for the infinite grid. All row positions are
  // derived from this and updated via GSAP for smooth motion.
  const worldOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track canvas and viewport sizes so we can clamp panning and prevent the
  // user from dragging too far outside the finite grid.
  const canvasSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const viewportSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const panBoundsRef = useRef<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }>({
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
  });

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

  // While the intro zoom animation is playing (after the loading overlay
  // disappears), we temporarily disable dragging and wheel zoom so the camera
  // motion feels like a single, uninterrupted move.
  const isIntroAnimatingRef = useRef<boolean>(true);

  // Also track whenever we are programmatically animating the camera (zooming
  // in to a tile or zooming out) to prevent user interactions from conflicting
  // with the automatic movement.
  const isTileAnimatingRef = useRef<boolean>(false);

  const { activeCategories } = useGalleryFilter();

  // Derived styling constants based on device
  const tileGapVw = isMobile ? MOBILE_TILE_GAP_VW : DESKTOP_TILE_GAP_VW;
  const tileGap = `${tileGapVw}vw`;
  const tilePadding = `${tileGapVw / 2}vw`;

  // Calculate grid dimensions based on project count so the overall canvas is
  // roughly square. If there are fewer than MIN_PROJECTS_FOR_CANVAS projects
  // we deterministically repeat them up to that number, but the grid itself is
  // still finite – no more infinite wrapping.
  const { gridRows, gridCols, numberOfImages } = useMemo(() => {
    const totalProjects = projects?.length ?? 0;

    if (totalProjects === 0) {
      return {
        gridRows: 0,
        gridCols: 0,
        numberOfImages: 0,
      };
    }

    const effectiveCount = Math.max(totalProjects, MIN_PROJECTS_FOR_CANVAS);
    const cols = Math.ceil(Math.sqrt(effectiveCount));
    const rows = Math.ceil(effectiveCount / cols);

    return {
      gridRows: rows,
      gridCols: cols,
      numberOfImages: effectiveCount,
    };
  }, [projects]);

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

  // Build tile descriptors from projects, repeating them deterministically to
  // fill the finite grid. Falls back to placeholder metadata if there are no
  // projects.
  const tilesWithCategories = useMemo<TileDescriptor[]>(() => {
    if (projects && projects.length > 0) {
      // Map projects to tiles first
      const baseTiles: Omit<TileDescriptor, "index">[] = projects.map(
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

          const isVideoLink =
            project.media?.mediaType === "video" &&
            !!project.media?.video?.videoLink;

          if (isVideoLink) {
            // For external video links (YouTube/Vimeo), force a 16:9 tile so the
            // visual ratio is based on the video itself rather than any
            // thumbnail image metadata.
            const ar = 16 / 9;
            widthFactor = ar;
            aspectRatio = "16 / 9";
            // padding-top uses height / width * 100
            aspectPadding = `${(1 / ar) * 100}%`;
          } else if (dimensions) {
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

      // Expand to fill the grid (repeating the projects list)
      let allTiles: Omit<TileDescriptor, "index">[] = [];
      while (allTiles.length < numberOfImages) {
        allTiles = [...allTiles, ...baseTiles];
      }
      // Trim to exact size
      allTiles = allTiles.slice(0, numberOfImages);

      // Shuffle the expanded list deterministically so the pattern of repetition
      // is broken up, but the result is consistent across hydration.
      // Using a simple LCG seeded with a constant.
      let seed = 42;
      const m = 0x80000000;
      const a = 1103515245;
      const c = 12345;
      const nextFloat = () => {
        seed = (a * seed + c) % m;
        return seed / (m - 1);
      };

      // Fisher-Yates shuffle on the full list
      for (let i = allTiles.length - 1; i > 0; i--) {
        const j = Math.floor(nextFloat() * (i + 1));
        [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
      }

      // Assign indices
      return allTiles.map((tile, index) => ({
        ...tile,
        index,
      }));
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

  // Apply the current world offset as a translation to the entire canvas
  // container. This replaces the previous per-row wrapping logic so panning is
  // now finite and the user can reach the actual edges of the grid.
  const updateCanvasTransform = () => {
    if (!containerRef.current) return;
    const { x, y } = worldOffsetRef.current;
    gsap.set(containerRef.current, { x, y });
  };

  const setActiveTile = (index: number | null) => {
    activeTileIndexRef.current = index;
    moveSinceActiveRef.current = 0;
    setActiveTileIndex(index);
  };

  // Initial zoom state: render the canvas slightly zoomed out while the loading
  // overlay is visible so that when it disappears we can animate smoothly into
  // the default zoom level.
  useEffect(() => {
    if (!zoomLayerRef.current) return;

    const vv = window.visualViewport;
    const viewportWidth = vv?.width ?? window.innerWidth;
    const isMobileViewport = viewportWidth <= 768;

    // Use the special intro zoom level so the opening move can start much
    // further out than the normal interactive MIN zoom.
    const initialZoom = isMobileViewport
      ? CANVAS_ZOOM_INTRO_MOBILE
      : CANVAS_ZOOM_INTRO;

    canvasScaleRef.current = initialZoom;
    gsap.set(zoomLayerRef.current, {
      scale: initialZoom,
      transformOrigin: "50% 50%",
    });
  }, []);
  // Helper to calculate panning bounds based on zoom level.
  // This ensures that as we zoom in, the user can pan further to reach the edges.
  const getPanBounds = useCallback((scale: number) => {
    const { width: canvasWidth, height: canvasHeight } = canvasSizeRef.current;
    const { width: viewportWidth, height: viewportHeight } =
      viewportSizeRef.current;

    // Add padding (approx 10vw / 10vh) so we can always pan to the edge
    const padX = viewportWidth * 0.1;
    const padY = viewportHeight * 0.1;

    // X Axis
    const visualWidth = canvasWidth * scale;

    // Calculate overflow considering padding
    // We want to allow panning until the edge is padX inside/outside the viewport
    // Formula: Max Offset = (VisualWidth - ViewportWidth + 2 * Padding) / (2 * Scale)
    // This allows panning past the edge by padX/scale in unscaled units
    // Ensure halfX is at least 0 to prevent minX > maxX when content fits in viewport
    const halfX = Math.max(
      0,
      (visualWidth - viewportWidth + 2 * padX) / (2 * scale)
    );
    const minX = -halfX;
    const maxX = halfX;

    // Y Axis
    // Calculate vertical bounds allowing for padding
    // MaxY (pulling down) -> Visual Top moves to padY
    const maxY = viewportHeight / 2 + (padY - viewportHeight / 2) / scale;

    // MinY (pulling up) -> Visual Bottom moves to ViewportHeight - padY
    const minY =
      viewportHeight / 2 + (viewportHeight / 2 - padY) / scale - canvasHeight;

    return { minX, maxX, minY, maxY };
  }, []);

  // Track canvas and viewport size so we can derive symmetric panning bounds
  // and keep the canvas centred on both desktop and mobile.
  const recalcPanBounds = useCallback(() => {
    if (!containerRef.current) return;

    // Measure content width correctly by checking children (rows).
    // InfiniteCanvasInner centers content, so container.scrollWidth might not
    // reflect the full width if content overflows to the left (which is clipped/ignored in measurements).
    let contentWidth = containerRef.current.scrollWidth;
    const contentHeight = containerRef.current.scrollHeight;

    const children = containerRef.current.children;
    if (children.length > 0) {
      let maxChildWidth = 0;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        // Use offsetWidth to get the rendered width of the row
        maxChildWidth = Math.max(maxChildWidth, child.offsetWidth);
      }
      // If rows are wider than what the container reports, use that
      if (maxChildWidth > contentWidth) {
        contentWidth = maxChildWidth;
      }
    }

    const canvasWidth = contentWidth;
    const canvasHeight = contentHeight;

    const vv = window.visualViewport;

    // Base viewport size on the wrapper's rendered size so we centre and
    // bound the canvas relative to the actual canvas area (which may be
    // smaller than the full window on mobile due to headers, browser chrome,
    // safe areas, etc.).
    let viewportWidth = vv?.width ?? window.innerWidth;
    let viewportHeight = vv?.height ?? window.innerHeight;

    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      viewportWidth = rect.width || viewportWidth;
      viewportHeight = rect.height || viewportHeight;
    }

    canvasSizeRef.current = { width: canvasWidth, height: canvasHeight };
    viewportSizeRef.current = {
      width: viewportWidth,
      height: viewportHeight,
    };

    // Calculate bounds based on current scale
    const currentScale = canvasScaleRef.current || 1;
    const { minX, maxX, minY, maxY } = getPanBounds(currentScale);

    panBoundsRef.current = { minX, maxX, minY, maxY };

    let nextX = worldOffsetRef.current.x;
    let nextY = worldOffsetRef.current.y;

    // On first load, start exactly at the visual centre of the canvas so the
    // intro zoom lands in the middle for both desktop and mobile.
    if (nextX === 0 && nextY === 0) {
      nextX = 0;
      nextY = (viewportHeight - canvasHeight) / 2;
    }

    nextX = gsap.utils.clamp(minX, maxX, nextX);
    nextY = gsap.utils.clamp(minY, maxY, nextY);

    worldOffsetRef.current.x = nextX;
    worldOffsetRef.current.y = nextY;

    // Keep the incremental targets in sync so quickTo animations continue
    // smoothly from the current centred position.
    incrXRef.current = nextX;
    incrYRef.current = nextY;

    updateCanvasTransform();
  }, [getPanBounds, gridRows, gridCols, numberOfImages]);

  useEffect(() => {
    recalcPanBounds();

    const handleResize = () => {
      recalcPanBounds();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [recalcPanBounds]);

  const zoomOutCanvas = () => {
    if (!zoomLayerRef.current || canvasScaleRef.current === CANVAS_ZOOM_DEFAULT)
      return;

    canvasScaleRef.current = CANVAS_ZOOM_DEFAULT;
    moveSinceZoomRef.current = 0;
    zoomStageRef.current = 0;
    setActiveTile(null);

    gsap.to(zoomLayerRef.current, {
      scale: CANVAS_ZOOM_DEFAULT,
      transformOrigin: "50% 50%",
      duration: CANVAS_ZOOM_DURATION,
      ease: "power3.out",
    });
  };

  const handleTileClick = (event: MouseEvent<HTMLDivElement>) => {
    // Don't trigger click if user was dragging significantly
    // Allow clicks if drag distance was very small (less than 10px) - this handles iOS tap issues
    if (isDraggingRef.current && dragDistanceRef.current >= 10) {
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

    let targetWorldX = worldOffsetRef.current.x + deltaX;
    let targetWorldY = worldOffsetRef.current.y + deltaY;

    // Calculate target zoom early to determine appropriate bounds
    const vvForZoom = window.visualViewport;
    const viewportWidthForZoom = vvForZoom?.width ?? window.innerWidth;
    const isMobileViewportForZoom = viewportWidthForZoom <= 768;
    const targetZoom = isMobileViewportForZoom
      ? CANVAS_ZOOM_MAX_MOBILE
      : CANVAS_ZOOM_MAX;

    // Clamp the target "camera" position into our panning bounds for the TARGET zoom level
    const { minX, maxX, minY, maxY } = getPanBounds(targetZoom);
    targetWorldX = gsap.utils.clamp(minX, maxX, targetWorldX);
    targetWorldY = gsap.utils.clamp(minY, maxY, targetWorldY);

    // Update incremental refs to match the target
    // Calculate the delta needed to reach target from current incremental position
    const deltaIncrX = targetWorldX - incrXRef.current;
    const deltaIncrY = targetWorldY - incrYRef.current;

    incrXRef.current += deltaIncrX;
    incrYRef.current += deltaIncrY;

    // Smoothly animate the "camera" so the clicked tile moves to center
    // Use gsap.to explicitly to match the scale animation duration and easing,
    // avoiding the "snap" effect caused by mismatched quickTo configuration.

    // Block interactions during the animation
    isTileAnimatingRef.current = true;

    gsap.to(worldOffsetRef.current, {
      x: targetWorldX,
      y: targetWorldY,
      duration: CANVAS_ZOOM_DURATION,
      ease: "power3.out",
      onComplete: () => {
        isTileAnimatingRef.current = false;
      },
    });

    // Then zoom the entire canvas (wrapper) around the viewport center.
    // Because the tile is already centered in the viewport, scaling around
    // the viewport center keeps that tile centered while everything grows.
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

    // Use a ticker to continuously update the canvas position during smooth animation
    const ticker = gsap.ticker.add(() => {
      updateCanvasTransform();
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
        // Disable dragging during the intro zoom so the camera motion feels
        // like a single uninterrupted move.
        if (isIntroAnimatingRef.current || isTileAnimatingRef.current) {
          return;
        }

        // This fires when a pointer/touch drag starts (not wheel)
        isDraggingRef.current = true;
        dragDistanceRef.current = 0; // Reset drag distance
        if (wrapperRef.current) {
          wrapperRef.current.classList.add("is-dragging");
        }

        // Store current zoom level and zoom out slightly during drag
        // Only apply this effect when at the furthest zoom out level (scale = 1)
        if (zoomLayerRef.current) {
          const currentZoom = canvasScaleRef.current;
          zoomBeforeDragRef.current = currentZoom;

          // Only zoom out during drag if we're at the base zoom level (1)
          // This prevents interference with the auto zoom-out functionality when zoomed in
          if (currentZoom <= 1) {
            // Zoom out by 5% (multiply by 0.95)
            const dragZoomOut = currentZoom * 0.95;
            canvasScaleRef.current = dragZoomOut;

            gsap.to(zoomLayerRef.current, {
              scale: dragZoomOut,
              transformOrigin: "50% 50%",
              duration: 1,
              ease: "power2.out",
            });
          }
        }
      },

      onDragEnd: () => {
        if (wrapperRef.current) {
          wrapperRef.current.classList.remove("is-dragging");
        }

        // Restore zoom to the level before drag started
        // Only restore if we applied the zoom-out effect (i.e., we were at scale = 1)
        if (zoomLayerRef.current) {
          const restoreZoom = zoomBeforeDragRef.current;
          const wasAtBaseZoom = restoreZoom <= 1;

          // Only restore if we actually zoomed out during drag
          if (wasAtBaseZoom && canvasScaleRef.current < restoreZoom) {
            canvasScaleRef.current = restoreZoom;

            gsap.to(zoomLayerRef.current, {
              scale: restoreZoom,
              transformOrigin: "50% 50%",
              duration: 1,
              ease: "power2.out",
            });
          }
        }

        // Delay resetting isDraggingRef and dragDistanceRef slightly so that any click event
        // firing immediately after mouseup can see that a drag just happened.
        setTimeout(() => {
          isDraggingRef.current = false;
          dragDistanceRef.current = 0;
        }, 50);
      },

      onWheel: (self) => {
        // Disable wheel zoom during the intro zoom animation.
        if (isIntroAnimatingRef.current || isTileAnimatingRef.current) {
          return;
        }
        // Prevent browser default behaviors (including swipe-back) on wheel/trackpad gestures
        if (self.event && self.event.preventDefault) {
          self.event.preventDefault();
        }

        // Handle zoom from center of screen
        if (!zoomLayerRef.current) return;

        // Get viewport dimensions (prefer visualViewport for mobile)
        const vv = window.visualViewport;
        const viewportWidth = vv?.width ?? window.innerWidth;

        // Determine zoom direction and amount
        // Use deltaY for vertical scroll, deltaX for horizontal scroll (trackpad)
        const scrollDelta =
          Math.abs(self.deltaY) > Math.abs(self.deltaX)
            ? -self.deltaY
            : -self.deltaX;

        // Zoom sensitivity - adjust this value to make zoom faster/slower
        const zoomSensitivity = 0.001;
        const zoomDelta = scrollDelta * zoomSensitivity;

        // Get current scale and calculate new scale
        const currentScale = canvasScaleRef.current;
        let newScale = currentScale + zoomDelta;

        // Determine min/max zoom based on device
        const isMobileViewport = viewportWidth <= 768;
        const maxZoom = isMobileViewport
          ? CANVAS_ZOOM_MAX_MOBILE
          : CANVAS_ZOOM_MAX;
        const minZoom = isMobileViewport
          ? CANVAS_ZOOM_MIN_MOBILE
          : CANVAS_ZOOM_MIN;

        // Clamp zoom between min and max
        newScale = Math.max(minZoom, Math.min(maxZoom, newScale));

        // Only update if scale actually changed
        if (newScale === currentScale) return;

        // Update scale ref
        canvasScaleRef.current = newScale;

        // Apply zoom from center of screen
        const zoomLayer = zoomLayerRef.current;
        gsap.set(zoomLayer, {
          scale: newScale,
          transformOrigin: "50% 50%",
        });

        // Mark panning for pointer-events
        markPanning();
      },

      onChangeX: (self) => {
        // Disable horizontal panning while the intro zoom is animating.
        if (isIntroAnimatingRef.current || isTileAnimatingRef.current) {
          return;
        }
        // Only handle drag/touch events, not wheel events (wheel is for zooming)
        if (self.event.type === "wheel") {
          return;
        }

        // Prevent browser swipe-back gesture on desktop trackpad when panning horizontally
        if (self.event && self.event.preventDefault) {
          self.event.preventDefault();
        }

        // markPanning acts as a general "activity" indicator for performance
        markPanning();

        const delta = self.deltaX * 2 * PAN_SENSITIVITY;

        // Update incremental value and use quickTo for smooth animation,
        // clamping the target into our finite pan bounds.
        incrXRef.current += delta;

        // Use current visual scale for bounds to prevent snapping during zoom-out animation
        const currentScale = zoomLayerRef.current
          ? (gsap.getProperty(zoomLayerRef.current, "scale") as number)
          : canvasScaleRef.current;

        // Use dynamic bounds based on current zoom level
        const { minX, maxX } = getPanBounds(currentScale);

        incrXRef.current = gsap.utils.clamp(minX, maxX, incrXRef.current);
        xTo(incrXRef.current);

        const distance = Math.abs(self.deltaX);

        // Track total drag distance for tap detection
        dragDistanceRef.current += distance;

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
        // Disable vertical panning while the intro zoom is animating.
        if (isIntroAnimatingRef.current || isTileAnimatingRef.current) {
          return;
        }
        // Only handle drag/touch events, not wheel events (wheel is for zooming)
        if (self.event.type === "wheel") {
          return;
        }

        // Prevent browser default behaviors when panning vertically
        if (self.event && self.event.preventDefault) {
          self.event.preventDefault();
        }

        markPanning();

        const delta = self.deltaY * 2 * PAN_SENSITIVITY;

        // Update incremental value and use quickTo for smooth animation,
        // clamping the target into our finite pan bounds.
        incrYRef.current += delta;

        // Use current visual scale for bounds to prevent snapping during zoom-out animation
        const currentScale = zoomLayerRef.current
          ? (gsap.getProperty(zoomLayerRef.current, "scale") as number)
          : canvasScaleRef.current;

        // Use dynamic bounds based on current zoom level
        const { minY, maxY } = getPanBounds(currentScale);

        incrYRef.current = gsap.utils.clamp(minY, maxY, incrYRef.current);
        yTo(incrYRef.current);

        const distance = Math.abs(self.deltaY);

        // Track total drag distance for tap detection
        dragDistanceRef.current += distance;

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

  // When the loading overlay has finished its intro and fades out, smoothly
  // zoom from the initial \"far\" zoom into our default zoom level so the user
  // lands in a natural viewing state.
  useEffect(() => {
    const handleLoadingComplete = () => {
      if (!zoomLayerRef.current) return;

      const vv = window.visualViewport;
      const viewportWidth = vv?.width ?? window.innerWidth;
      const isMobileViewport = viewportWidth <= 768;

      const defaultZoom = isMobileViewport
        ? CANVAS_ZOOM_DEFAULT_MOBILE
        : CANVAS_ZOOM_DEFAULT;

      // Block user panning/zooming while this intro animation runs.
      isIntroAnimatingRef.current = true;

      gsap.to(zoomLayerRef.current, {
        scale: defaultZoom,
        transformOrigin: "50% 50%",
        duration: 2,
        delay: 0,
        ease: "power3.out",
        onComplete: () => {
          canvasScaleRef.current = defaultZoom;
          moveSinceZoomRef.current = 0;
          zoomStageRef.current = 0;
          isIntroAnimatingRef.current = false;

          // After the intro zoom finishes, recenter the camera using the
          // latest canvas and viewport measurements so that the user always
          // lands in the exact middle of the canvas (especially important on
          // mobile where the viewport can change as chrome hides).
          // We intentionally do NOT force worldOffset to 0,0 here because that
          // would trigger the "first load" centering logic in recalcPanBounds,
          // causing a visual snap if the viewport height has changed (mobile URL bar).
          // Instead, we just let recalcPanBounds clamp the *existing* position
          // to the new bounds, which is smoother.
          recalcPanBounds();
        },
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("loading-complete", handleLoadingComplete);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("loading-complete", handleLoadingComplete);
      }
    };
  }, []);

  const handleTileClickWrapper = useCallback(
    (event: MouseEvent<HTMLDivElement>, tileIndex: number) => {
      // Ignore tile clicks during the intro zoom animation to avoid fighting
      // with the initial camera move.
      if (isIntroAnimatingRef.current || isTileAnimatingRef.current) {
        return;
      }

      // Check if the clicked tile is already active
      const isActive = tileIndex === activeTileIndexRef.current;

      // If active and zoomed in, zoom out and clear active state
      if (isActive && canvasScaleRef.current > 1) {
        setActiveTile(null);
        zoomOutCanvas();
        return;
      }

      // Otherwise, set active and zoom in
      setActiveTile(tileIndex);
      handleTileClick(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <InfiniteCanvasWrapper ref={wrapperRef}>
      <ZoomLayer ref={zoomLayerRef}>
        <InfiniteCanvasInner ref={containerRef}>
          {Array.from({ length: gridRows }, (_, rowIndex) => {
            const startIndex = rowIndex * gridCols;
            const endIndex = startIndex + gridCols;
            const rowTiles = tilesWithVisibility.slice(startIndex, endIndex);

            return (
              <BlockWrapper key={`row-${rowIndex}`}>
                <Block $gap={tileGap} $padding={tilePadding}>
                  {rowTiles.map((tile) => {
                    const isActive = activeTileIndex === tile.index;

                    return (
                      <InfiniteCanvasTile
                        key={`row-${rowIndex}-tile-${tile.index}`}
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
              </BlockWrapper>
            );
          })}
        </InfiniteCanvasInner>
      </ZoomLayer>
    </InfiniteCanvasWrapper>
  );
};

export default InfiniteCanvas;
