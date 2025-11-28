import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";

const InfiniteCanvas3Wrapper = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const CanvasElement = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

type MediaCategory = "photo" | "video" | "mixed";

type AspectRatio =
  | "fourByFive"
  | "fiveByFour"
  | "fourByThree"
  | "threeByFour"
  | "sixteenByNine";

type GalleryItem = {
  id: string;
  category: MediaCategory;
  aspectRatio: AspectRatio;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Circular layout row counts (middle row widest)
const ROW_ITEM_COUNTS = [
  2, 4, 6, 8, 10, 12, 14, 16, 18, 16, 14, 12, 10, 8, 6, 4, 2,
] as const;

const ASPECT_SEQUENCE: AspectRatio[] = [
  "fourByFive",
  "fourByThree",
  "sixteenByNine",
  "fiveByFour",
  "threeByFour",
];

const CATEGORY_SEQUENCE: MediaCategory[] = ["photo", "video", "mixed"];

const TILE_BASE_WIDTH = 220;
const TILE_BASE_HEIGHT = 180;
const GAP_X = 24;
const ROW_SPACING = 220;

const buildItems = (): GalleryItem[] => {
  const items: GalleryItem[] = [];
  const rowCount = ROW_ITEM_COUNTS.length;
  const midRowIndex = (rowCount - 1) / 2;

  ROW_ITEM_COUNTS.forEach((count, rowIndex) => {
    const totalWidth = count * TILE_BASE_WIDTH + (count - 1) * GAP_X;
    const startX = -totalWidth / 2;
    const y = (rowIndex - midRowIndex) * ROW_SPACING;

    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      const id = `row-${rowIndex}-item-${itemIndex}`;

      const category =
        CATEGORY_SEQUENCE[(rowIndex + itemIndex) % CATEGORY_SEQUENCE.length];
      const aspectRatio =
        ASPECT_SEQUENCE[(rowIndex + itemIndex) % ASPECT_SEQUENCE.length];

      const x = startX + itemIndex * (TILE_BASE_WIDTH + GAP_X);

      items.push({
        id,
        category,
        aspectRatio,
        x,
        y,
        width: TILE_BASE_WIDTH,
        height: TILE_BASE_HEIGHT,
      });
    }
  });

  return items;
};

const getPlaceholderSizeForAspect = (
  aspect: AspectRatio,
  scale = 1
): { width: number; height: number } => {
  switch (aspect) {
    case "fourByFive": {
      const baseWidth = 400 * scale;
      const width = Math.max(1, Math.round(baseWidth));
      const height = Math.round((width * 5) / 4);
      return { width, height };
    }
    case "fiveByFour": {
      const baseWidth = 500 * scale;
      const width = Math.max(1, Math.round(baseWidth));
      const height = Math.round((width * 4) / 5);
      return { width, height };
    }
    case "threeByFour": {
      const baseWidth = 300 * scale;
      const width = Math.max(1, Math.round(baseWidth));
      const height = Math.round((width * 4) / 3);
      return { width, height };
    }
    case "fourByThree": {
      const baseWidth = 400 * scale;
      const width = Math.max(1, Math.round(baseWidth));
      const height = Math.round((width * 3) / 4);
      return { width, height };
    }
    case "sixteenByNine":
    default: {
      const baseWidth = 800 * scale;
      const width = Math.max(1, Math.round(baseWidth));
      const height = Math.round((width * 9) / 16);
      return { width, height };
    }
  }
};

const getPlaceholderSrc = (
  item: GalleryItem,
  variant: "low" | "high" = "high"
): string => {
  const scale = variant === "low" ? 0.3 : 1;
  const { width, height } = getPlaceholderSizeForAspect(
    item.aspectRatio,
    scale
  );
  const seed = item.id;
  return `https://picsum.photos/seed/${encodeURIComponent(
    seed
  )}/${width}/${height}`;
};

const InfiniteCanvas3 = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const items = useMemo(() => buildItems(), []);

  // Camera state (world -> screen transform)
  const camera = useRef({
    scale: 0.5,
    offsetX: 0,
    offsetY: 0,
    velX: 0,
    velY: 0,
  });

  // Image cache
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const hoveredIdRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Center world origin in the middle of the screen
      camera.current.offsetX = rect.width / 2;
      camera.current.offsetY = rect.height / 2;
    };

    resize();
    window.addEventListener("resize", resize);

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastTime) / 1000); // seconds
      lastTime = now;

      // Apply inertial motion to camera offsets
      camera.current.offsetX += camera.current.velX * dt;
      camera.current.offsetY += camera.current.velY * dt;

      // Simple friction-based damping
      const FRICTION = 0.9;
      camera.current.velX *= FRICTION;
      camera.current.velY *= FRICTION;

      if (Math.abs(camera.current.velX) < 1) camera.current.velX = 0;
      if (Math.abs(camera.current.velY) < 1) camera.current.velY = 0;

      const rect = canvas.getBoundingClientRect();
      const { scale, offsetX, offsetY } = camera.current;

      ctx.clearRect(0, 0, rect.width, rect.height);

      // Apply camera transform
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Read duotone toggle from body class
      const isRemoveDuotone =
        typeof document !== "undefined" &&
        document.body.classList.contains("remove-duotone");

      items.forEach((item) => {
        const imgKey = `${item.id}-high`;
        let img = imageCache.current[imgKey];

        if (!img) {
          img = new window.Image();
          img.src = getPlaceholderSrc(item, "high");
          imageCache.current[imgKey] = img;
        }

        const isHovered = hoveredIdRef.current === item.id;

        if (img.complete && img.naturalWidth > 0) {
          // When duotone is active and tile isn't hovered, draw a filtered base.
          if (!isRemoveDuotone && !isHovered) {
            ctx.save();
            // Approximate the CSS filters from .image-colour-base
            ctx.filter = "grayscale(100%) brightness(190%) contrast(220%)";
            ctx.drawImage(img, item.x, item.y, item.width, item.height);
            ctx.restore();
          } else {
            // Full-colour high-res image
            ctx.drawImage(img, item.x, item.y, item.width, item.height);
          }
        } else {
          // Fallback placeholder rect
          ctx.fillStyle = "#222";
          ctx.fillRect(item.x, item.y, item.width, item.height);
        }
      });

      ctx.restore();

      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [items]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;

    const handlePointerDown = (event: PointerEvent) => {
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = performance.now();

      // Stop existing inertia when user starts a new drag
      camera.current.velX = 0;
      camera.current.velY = 0;

      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastTime); // ms

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;

      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = now;

      camera.current.offsetX += dx;
      camera.current.offsetY += dy;

      // Pixels per second
      camera.current.velX = (dx / dt) * 1000;
      camera.current.velY = (dy / dt) * 1000;

      // Track hovered tile in world coordinates for hover effect
      const rect = canvas.getBoundingClientRect();
      const { scale, offsetX, offsetY } = camera.current;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const worldX = (mouseX - offsetX) / scale;
      const worldY = (mouseY - offsetY) / scale;

      let hovered: string | null = null;
      for (const item of items) {
        if (
          worldX >= item.x &&
          worldX <= item.x + item.width &&
          worldY >= item.y &&
          worldY <= item.y + item.height
        ) {
          hovered = item.id;
          break;
        }
      }
      hoveredIdRef.current = hovered;
    };

    const handlePointerUp = (event: PointerEvent) => {
      isDragging = false;
      canvas.releasePointerCapture(event.pointerId);
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const { offsetX, offsetY, scale } = camera.current;

      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const zoomFactor = 1 - event.deltaY * 0.0015;
      const nextScale = Math.max(0.3, Math.min(1.8, scale * zoomFactor));

      if (nextScale === scale) return;

      // Zoom around cursor
      const worldX = (mouseX - offsetX) / scale;
      const worldY = (mouseY - offsetY) / scale;

      camera.current.scale = nextScale;
      camera.current.offsetX = mouseX - worldX * nextScale;
      camera.current.offsetY = mouseY - worldY * nextScale;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // NOTE: <Image> import is unused but kept available if you want to
  // overlay DOM-based content on top of the canvas later.

  return (
    <InfiniteCanvas3Wrapper>
      <CanvasElement ref={canvasRef} />
    </InfiniteCanvas3Wrapper>
  );
};

export default InfiniteCanvas3;
