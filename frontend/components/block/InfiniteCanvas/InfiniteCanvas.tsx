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
const GRID_SIZE = 7; // 7x7 grid of tiles per logical block

// How many vertical stacks of rows to render for seamless vertical panning
const VERTICAL_STACKS = 3;

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

const Tile = styled(motion.div)<{
  $isVisible: boolean;
  $isDragging: boolean;
  $aspectRatio: string;
}>`
  aspect-ratio: ${(props) => props.$aspectRatio};
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
  aspectRatio: string;
  isVisible: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  isDragging: boolean;
};

const InfiniteCanvasTile = ({
  index,
  category,
  aspectRatio,
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

  return (
    <Tile
      ref={ref}
      onClick={onClick}
      onMouseDown={onMouseDown}
      $isVisible={isVisible}
      $isDragging={isDragging}
      $aspectRatio={aspectRatio}
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasScaleRef = useRef<number>(1);
  const moveSinceZoomRef = useRef<number>(0);
  const zoomStageRef = useRef<0 | 1 | 2>(0); // 0 = no zoom, 1 = full zoom, 2 = intermediate zoom
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Per-row horizontal / vertical infinite scrolling state
  const blockWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowBlockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowWidthsRef = useRef<number[]>([]);
  const worldOffsetXRef = useRef<number>(0);
  const worldOffsetYRef = useRef<number>(0);
  const rowHeightRef = useRef<number>(0);

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
  const updateRowPositions = () => {
    const worldX = worldOffsetXRef.current;

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
  const updateVerticalPositions = () => {
    const rowHeight = rowHeightRef.current;

    if (!rowHeight) return;

    const stackHeight = rowHeight * GRID_SIZE;
    const wrapWorldY = gsap.utils.wrap(-stackHeight, 0);
    const worldY = wrapWorldY(worldOffsetYRef.current);

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

    const deltaY = (viewportCenterY - tileCenterY) / currentScale;

    worldOffsetYRef.current += deltaY;
    updateVerticalPositions();

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

    const observer = Observer.create({
      target: window,
      type: "wheel,touch,pointer",
      onChangeX: (self) => {
        const delta =
          self.event.type === "wheel"
            ? -self.deltaX * PAN_SENSITIVITY
            : self.deltaX * 2 * PAN_SENSITIVITY;

        worldOffsetXRef.current += delta;

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

        updateRowPositions();
      },
      onChangeY: (self) => {
        const delta =
          self.event.type === "wheel"
            ? -self.deltaY * PAN_SENSITIVITY
            : self.deltaY * 2 * PAN_SENSITIVITY;

        worldOffsetYRef.current += delta;

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

        updateVerticalPositions();
      },
    });

    return () => {
      observer.kill();
    };
  }, []);

  const renderRowContent = (
    rowIndex: number,
    instanceIndex: number,
    blockRef?: (el: HTMLDivElement | null) => void
  ) => {
    const startIndex = rowIndex * GRID_SIZE;
    const endIndex = startIndex + GRID_SIZE;
    const rowTiles = tilesWithVisibility.slice(startIndex, endIndex);

    return (
      <Block aria-hidden={instanceIndex !== 0} ref={blockRef}>
        {rowTiles.map((tile) => (
          <InfiniteCanvasTile
            key={`inst-${instanceIndex}-row-${rowIndex}-${tile.index}`}
            index={tile.index}
            category={tile.category}
            aspectRatio={tile.aspectRatio}
            isVisible={tile.isVisible}
            onClick={handleTileClick}
            onMouseDown={handleTileMouseDown}
            isDragging={isDragging}
          />
        ))}
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
                  rowIndex,
                  0,
                  stackIndex === 0
                    ? (el) => {
                        rowBlockRefs.current[rowIndex] = el;
                      }
                    : undefined
                )}
                {renderRowContent(rowIndex, 1)}
                {renderRowContent(rowIndex, 2)}
              </BlockWrapper>
            );
          })
        )}
      </InfiniteCanvasInner>
    </InfiniteCanvasWrapper>
  );
};

export default InfiniteCanvas;
