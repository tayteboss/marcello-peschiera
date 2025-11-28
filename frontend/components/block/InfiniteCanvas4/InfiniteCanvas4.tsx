"use client";

import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { MouseEvent, useEffect, useRef } from "react";
import styled from "styled-components";

gsap.registerPlugin(Observer);

// Square grid configuration so horizontal and vertical wrapping behave the same
const GRID_SIZE = 7; // 7x7 grid of tiles per block

// Controls horizontal/vertical spacing in vw units so layout scales with viewport.
// Padding is half the gap for a uniform look at the block edges.
const TILE_GAP_VW = 2; // visual gap between tiles (in vw)
const TILE_GAP = `${TILE_GAP_VW}vw`;
const TILE_PADDING = `${TILE_GAP_VW / 2}vw`; // padding is half the gap for a uniform look

// Zoom configuration for the entire canvas when a tile is clicked.
// This scales the whole infinite canvas around the clicked tile.
const CANVAS_ZOOM = 2; // how much to magnify the canvas when clicked
const CANVAS_ZOOM_DURATION = 1.5; // seconds

// Lower values make panning feel more sluggish (slower movement for the same input delta).
// Increase this if you want snappier / faster panning.
const PAN_SENSITIVITY = 0.5;

// Staged zoom-out thresholds (approx px of user movement after zoom).
// After FIRST_ZOOM_OUT_THRESHOLD, zoom out to INTERMEDIATE_CANVAS_ZOOM.
// After SECOND_ZOOM_OUT_THRESHOLD, zoom out fully to 1.
const FIRST_ZOOM_OUT_THRESHOLD = 500;
const SECOND_ZOOM_OUT_THRESHOLD = 10000; // 200 + 1000
const INTERMEDIATE_CANVAS_ZOOM = 1.5;

const InfiniteCanvasWrapper = styled.section`
  height: 100vh;
  width: 100%;
  overflow: hidden;
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

const Tile = styled.div`
  aspect-ratio: 1 / 1;
  background: blue;
  position: relative;
  width: 45vw;

  @media (min-width: 1024px) {
    width: 15vw;
  }
`;

const InfiniteCanvas4 = () => {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const xToRef = useRef<((value: number) => void) | null>(null);
  const yToRef = useRef<((value: number) => void) | null>(null);
  const incrRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasScaleRef = useRef<number>(1);
  const moveSinceZoomRef = useRef<number>(0);
  const zoomStageRef = useRef<0 | 1 | 2>(0); // 0 = no zoom, 1 = full zoom, 2 = intermediate zoom

  // GRID_SIZE x GRID_SIZE tiles to form a square block.
  const numberOfImages = GRID_SIZE * GRID_SIZE;

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

  const handleTileClick = (event: MouseEvent<HTMLDivElement>) => {
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

    // First, pan so that the clicked tile is centered in the viewport
    const deltaX = viewportCenterX - tileCenterX;
    const deltaY = viewportCenterY - tileCenterY;

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

  const generateImageNames = () => {
    const images = [];
    for (let i = 1; i <= numberOfImages; i++) {
      images.push(`img${i}.png`);
    }
    return images;
  };

  const mediaItems = generateImageNames();

  const renderContent = (isDuplicate = false) => (
    <Block aria-hidden={isDuplicate}>
      {mediaItems.map((image, index) => (
        <Tile
          key={`${isDuplicate ? "dup" : "orig"}-${index}`}
          onClick={handleTileClick}
        >
          Tile
        </Tile>
        // <div
        //   key={`${isDuplicate ? "dup" : "orig"}-${index}`}
        //   className={cn("aspect-square select-none", imageClassName)}
        // >
        //   <img
        //     src={`${imageRootPath}/${image}`}
        //     alt=""
        //     className="block h-full w-full object-contain"
        //   />
        // </div>
      ))}
    </Block>
  );

  return (
    <InfiniteCanvasWrapper ref={wrapperRef}>
      <InfiniteCanvasInner ref={containerRef}>
        {renderContent()}
        {renderContent(true)}
        {renderContent(true)}
        {renderContent(true)}
      </InfiniteCanvasInner>
    </InfiniteCanvasWrapper>
  );
};

export default InfiniteCanvas4;
