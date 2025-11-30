"use client";

import Image from "next/image";
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { MouseEvent, useEffect, useRef, useMemo, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { useInView } from "../../../hooks/useInView";
import {
  useGalleryFilter,
  FilterCategory,
} from "../../../shared/context/context";

gsap.registerPlugin(Observer);

// Square grid configuration so horizontal and vertical wrapping behave the same
const GRID_SIZE = 7; // 7x7 grid of tiles per block

// Controls horizontal/vertical spacing in vw units so layout scales with viewport.
// Padding is half the gap for a uniform look at the block edges.
const TILE_GAP_VW = 1; // visual gap between tiles (in vw)
const TILE_GAP = `${TILE_GAP_VW}vw`;
const TILE_PADDING = `${TILE_GAP_VW / 2}vw`; // padding is half the gap for a uniform look

// Zoom configuration for the entire canvas when a tile is clicked.
// This scales the whole infinite canvas around the clicked tile.
const CANVAS_ZOOM = 2; // how much to magnify the canvas when clicked
const CANVAS_ZOOM_DURATION = 1.5; // seconds
const INTERMEDIATE_CANVAS_ZOOM = 1.5;

// Staged zoom-out thresholds (approx px of user movement after zoom).
// After FIRST_ZOOM_OUT_THRESHOLD, zoom out to INTERMEDIATE_CANVAS_ZOOM.
// After SECOND_ZOOM_OUT_THRESHOLD, zoom out fully to 1.
const FIRST_ZOOM_OUT_THRESHOLD = 500;
const SECOND_ZOOM_OUT_THRESHOLD = 10000;

// Lower values make panning feel more sluggish (slower movement for the same input delta).
// Increase this if you want snappier / faster panning.
const PAN_SENSITIVITY = 0.5;

// Threshold in pixels to distinguish between a click and a drag
const DRAG_THRESHOLD = 5;

// Categories for testing - tiles will be assigned these categories in rotation
const TEST_CATEGORIES: FilterCategory[] = [
  "Photography",
  "Cinematography",
  "Direction",
];

// Placeholder sizing for images inside tiles (simple 4:3 ratio)
const getPlaceholderSize = (scale = 1): { width: number; height: number } => {
  const baseWidth = 400 * scale;
  const width = Math.max(1, Math.round(baseWidth));
  const height = Math.round((width * 3) / 4);
  return { width, height };
};

const getPlaceholderSrc = (
  index: number,
  variant: "low" | "high" = "high"
): string => {
  const scale = variant === "low" ? 0.3 : 1;
  const { width, height } = getPlaceholderSize(scale);
  const seed = `tile-${index}`;
  return `https://picsum.photos/seed/${encodeURIComponent(
    seed
  )}/${width}/${height}`;
};

const InfiniteCanvasWrapper = styled.section<{ $isDragging: boolean }>`
  height: 100vh;
  width: 100%;
  overflow: hidden;
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "default")};
`;

const InfiniteCanvasInner = styled.div`
  display: grid;
  width: max-content;
  grid-template-columns: repeat(2, auto);
  will-change: transform;
`;

const Block = styled.div`
  display: grid;
  width: max-content;
  /* GRID_SIZE columns × tile width + gaps + padding ensure each block is wider than the viewport */
  grid-template-columns: repeat(${GRID_SIZE}, auto);
  padding: ${TILE_PADDING};
  gap: ${TILE_GAP};
`;

const Tile = styled(motion.div)<{ $isVisible: boolean; $isDragging: boolean }>`
  aspect-ratio: 1 / 1;
  position: relative;
  width: auto;
  height: 15vw;
  opacity: ${(props) => (props.$isVisible ? 1 : 0)};
  pointer-events: ${(props) => (props.$isVisible ? "auto" : "none")};
  transition: opacity var(--transition-speed-default) var(--transition-ease);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "pointer")};
`;

const BaseImageLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
`;

const HighResImageLayer = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0;
  z-index: 2;
  transition: opacity var(--transition-speed-default) var(--transition-ease);
`;

const TileInner = styled(motion.div)`
  position: relative;
  width: 100%;
  height: 100%;

  &:hover {
    .high-res-image-layer {
      opacity: 1;
    }
  }
`;

type InfiniteCanvasTileProps = {
  index: number;
  category: FilterCategory;
  isVisible: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  isDragging: boolean;
};

const InfiniteCanvasTile = ({
  index,
  category,
  isVisible,
  onClick,
  onMouseDown,
  isDragging,
}: InfiniteCanvasTileProps) => {
  // Start loading images slightly before they enter the viewport
  const [ref, inView] = useInView({
    rootMargin: "300px",
    threshold: 0,
  });

  const randomAspectRatio = "16:9";

  return (
    <Tile
      ref={ref}
      onClick={onClick}
      onMouseDown={onMouseDown}
      $isVisible={isVisible}
      $isDragging={isDragging}
    >
      {inView && (
        <TileInner layout>
          <BaseImageLayer className="image-colour-base">
            <Image
              src={getPlaceholderSrc(index, "low")}
              alt=""
              fill
              style={{ objectFit: "cover" }}
              sizes="1vw"
              loading="lazy"
              draggable={false}
            />
          </BaseImageLayer>

          <HighResImageLayer className="high-res-image-layer">
            <Image
              src={getPlaceholderSrc(index, "high")}
              alt=""
              fill
              style={{ objectFit: "cover" }}
              sizes="30vw"
              loading="lazy"
              draggable={false}
            />
          </HighResImageLayer>
        </TileInner>
      )}
    </Tile>
  );
};

const InfiniteCanvas = () => {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const xToRef = useRef<((value: number) => void) | null>(null);
  const yToRef = useRef<((value: number) => void) | null>(null);
  const incrRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasScaleRef = useRef<number>(1);
  const moveSinceZoomRef = useRef<number>(0);
  const zoomStageRef = useRef<0 | 1 | 2>(0); // 0 = no zoom, 1 = full zoom, 2 = intermediate zoom
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const { activeCategories } = useGalleryFilter();

  // GRID_SIZE x GRID_SIZE tiles to form a square block.
  const numberOfImages = GRID_SIZE * GRID_SIZE;

  // Assign categories to tiles for testing
  // Uses Math.random() for completely random assignment (generated once on mount)
  const tilesWithCategories = useMemo(() => {
    return Array.from({ length: numberOfImages }, (_, index) => ({
      index,
      category: TEST_CATEGORIES[
        Math.floor(Math.random() * TEST_CATEGORIES.length)
      ] as FilterCategory,
    }));
    // Empty dependency array ensures this only runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine visibility for each tile based on active categories
  const tilesWithVisibility = useMemo(() => {
    const showAll =
      activeCategories.length === 0 || activeCategories.includes("All");

    return tilesWithCategories.map((tile) => ({
      ...tile,
      isVisible: showAll || activeCategories.includes(tile.category),
    }));
  }, [tilesWithCategories, activeCategories]);

  const zoomOutCanvas = () => {
    if (!wrapperRef.current || canvasScaleRef.current === 1) return;

    canvasScaleRef.current = 1;
    moveSinceZoomRef.current = 0;
    zoomStageRef.current = 0;

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

    if (
      !wrapperRef.current ||
      !containerRef.current ||
      !xToRef.current ||
      !yToRef.current
    )
      return;

    const wrapper = wrapperRef.current;
    const container = containerRef.current;
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

    const incr = incrRef.current;
    incr.x += deltaX;
    incr.y += deltaY;

    xToRef.current(incr.x);
    yToRef.current(incr.y);

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

    const container = containerRef.current;

    const halfX = container.clientWidth / 2;
    const wrapX = gsap.utils.wrap(-halfX, 0);
    const xTo = gsap.quickTo(container, "x", {
      duration: 1.5,
      ease: "power4",
      modifiers: {
        x: gsap.utils.unitize(wrapX),
      },
    });
    xToRef.current = xTo;

    const halfY = container.clientHeight / 2;
    const wrapY = gsap.utils.wrap(-halfY, 0);
    const yTo = gsap.quickTo(container, "y", {
      duration: 1.5,
      ease: "power4",
      modifiers: {
        y: gsap.utils.unitize(wrapY),
      },
    });
    yToRef.current = yTo;

    const observer = Observer.create({
      target: window,
      type: "wheel,touch,pointer",
      onChangeX: (self) => {
        const incr = incrRef.current;
        if (self.event.type === "wheel")
          incr.x -= self.deltaX * PAN_SENSITIVITY;
        else incr.x += self.deltaX * 2 * PAN_SENSITIVITY;

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

        xTo(incr.x);
      },
      onChangeY: (self) => {
        const incr = incrRef.current;
        if (self.event.type === "wheel")
          incr.y -= self.deltaY * PAN_SENSITIVITY;
        else incr.y += self.deltaY * 2 * PAN_SENSITIVITY;

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

        yTo(incr.y);
      },
    });

    return () => {
      observer.kill();
    };
  }, []);

  const renderContent = (isDuplicate = false) => (
    <Block aria-hidden={isDuplicate}>
      {tilesWithVisibility.map((tile) => (
        <InfiniteCanvasTile
          key={`${isDuplicate ? "dup" : "orig"}-${tile.index}`}
          index={tile.index}
          category={tile.category}
          isVisible={tile.isVisible}
          onClick={handleTileClick}
          onMouseDown={handleTileMouseDown}
          isDragging={isDragging}
        />
      ))}
    </Block>
  );

  return (
    <InfiniteCanvasWrapper ref={wrapperRef} $isDragging={isDragging}>
      <InfiniteCanvasInner ref={containerRef}>
        {renderContent()}
        {renderContent(true)}
        {renderContent(true)}
        {renderContent(true)}
      </InfiniteCanvasInner>
    </InfiniteCanvasWrapper>
  );
};

export default InfiniteCanvas;
