import Image from "next/image";
import { useEffect, useMemo, useState, MouseEvent } from "react";
import styled from "styled-components";
import { AnimatePresence, motion, useSpring } from "framer-motion";
import { useMousePosition } from "../../../hooks/useMousePosition";
import useWindowDimensions from "../../../hooks/useWindowDimensions";
import { useGalleryFilter } from "../../../shared/context/context";

const ViewportFrame = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const CanvasSurface = styled(motion.div)`
  position: absolute;
  top: -150vh;
  left: -150vw;
  width: 400vw;
  height: 400vh;
`;

const CanvasInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
`;

const Row = styled(motion.div)`
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 1rem;
  height: 18.75rem;
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
  row: number;
};

const Tile = styled(motion.div)<{ $aspect: AspectRatio }>`
  position: relative;
  aspect-ratio: ${({ $aspect }) => {
    if ($aspect === "fourByFive") return "4 / 5";
    if ($aspect === "fiveByFour") return "5 / 4";
    if ($aspect === "fourByThree") return "4 / 3";
    if ($aspect === "threeByFour") return "3 / 4";
    if ($aspect === "sixteenByNine") return "16 / 9";
    return "4 / 3";
  }};
  overflow: hidden;
  background: var(--colour-dark);
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

const TileInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  &:hover {
    .high-res-image-layer {
      opacity: 1;
    }
  }
`;

type GalleryRow = {
  index: number;
  items: GalleryItem[];
};

type GalleryPatternItem = Pick<GalleryItem, "category" | "aspectRatio">;

// Define an odd number of rows; middle row will contain the most tiles.
const ROW_ITEM_COUNTS = [
  16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16,
] as const;

const ROW_COUNT = ROW_ITEM_COUNTS.length;

const ASPECT_SEQUENCE: AspectRatio[] = [
  "fourByFive",
  "fourByThree",
  "sixteenByNine",
  "fiveByFour",
  "threeByFour",
];

const CATEGORY_SEQUENCE: MediaCategory[] = ["photo", "video", "mixed"];

const getRowPattern = (rowIndex: number): GalleryPatternItem[] => {
  const count = ROW_ITEM_COUNTS[rowIndex] ?? 2;

  return Array.from({ length: count }).map((_, itemIndex) => ({
    category:
      CATEGORY_SEQUENCE[(rowIndex + itemIndex) % CATEGORY_SEQUENCE.length],
    aspectRatio:
      ASPECT_SEQUENCE[(rowIndex + itemIndex) % ASPECT_SEQUENCE.length],
  }));
};

const GALLERY_ITEMS: GalleryItem[] = Array.from({ length: ROW_COUNT }).flatMap(
  (_, rowIndex) => {
    const pattern = getRowPattern(rowIndex);

    return pattern.map((patternItem, itemIndex) => ({
      id: `row-${rowIndex}-item-${itemIndex}-${patternItem.category}-${patternItem.aspectRatio}`,
      row: rowIndex,
      category: patternItem.category,
      aspectRatio: patternItem.aspectRatio,
    }));
  }
);

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.4;
const ZOOM_SENSITIVITY = 0.005;

const MOTION_CONFIG = {
  pan: {
    stiffness: 50,
    damping: 20,
    mass: 0.5,
  },
  zoom: {
    stiffness: 80,
    damping: 20,
    mass: 0.6,
  },
  panExtentFactor: 0.2,
  tileTransition: {
    duration: 0.6,
    ease: [0.65, 0, 0.35, 1] as [number, number, number, number],
  },
};

const BASE_ZOOM = 0.6;

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

const Canvas = () => {
  const { activeCategories } = useGalleryFilter();
  const mouse = useMousePosition();
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();

  const panX = useSpring(0, {
    ...MOTION_CONFIG.pan,
  });
  const panY = useSpring(0, {
    ...MOTION_CONFIG.pan,
  });
  const zoom = useSpring(BASE_ZOOM, {
    ...MOTION_CONFIG.zoom,
  });

  // Represents the "camera" origin – where the view is centered when the cursor
  // is in the middle of the screen. Clicking a tile updates this so that
  // cursor-based panning is relative to the last centered position.
  const [originPan, setOriginPan] = useState({ x: 0, y: 0 });

  const rows: GalleryRow[] = useMemo(() => {
    const map = new Map<number, GalleryItem[]>();
    GALLERY_ITEMS.forEach((item) => {
      const existing = map.get(item.row) ?? [];
      existing.push(item);
      map.set(item.row, existing);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([index, items]) => ({ index, items }));
  }, []);

  useEffect(() => {
    if (!viewportWidth || !viewportHeight) return;

    const currentZoom = zoom.get();
    const canvasWidth = viewportWidth * 4;
    const canvasHeight = viewportHeight * 4;
    const extraWidth = canvasWidth - viewportWidth;
    const extraHeight = canvasHeight - viewportHeight;

    // As we zoom in, allow a larger pan extent so you can reach outer tiles.
    const zoomFactor = Math.max(1, currentZoom / BASE_ZOOM);
    const maxPanX = extraWidth * MOTION_CONFIG.panExtentFactor * zoomFactor;
    const maxPanY = extraHeight * MOTION_CONFIG.panExtentFactor * zoomFactor;

    const mouseX =
      mouse.x == null || viewportWidth === 0 ? viewportWidth / 2 : mouse.x;
    const mouseY =
      mouse.y == null || viewportHeight === 0 ? viewportHeight / 2 : mouse.y;

    const nx = mouseX / viewportWidth;
    const ny = mouseY / viewportHeight;

    const cx = (nx - 0.5) * 2;
    const cy = (ny - 0.5) * 2;

    // Apply cursor-based parallax *around* the current originPan so that
    // wherever we last centered (e.g. via a tile click) becomes the new
    // reference point for panning.
    const targetX = originPan.x - cx * maxPanX;
    const targetY = originPan.y - cy * maxPanY;

    panX.set(targetX);
    panY.set(targetY);
  }, [
    mouse.x,
    mouse.y,
    viewportWidth,
    viewportHeight,
    zoom,
    panX,
    panY,
    originPan,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const currentScale = zoom.get();
      const nextScale = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, currentScale - event.deltaY * ZOOM_SENSITIVITY)
      );

      if (nextScale === currentScale) return;

      const mouseX = event.clientX;
      const mouseY = event.clientY;

      const currentPanX = panX.get();
      const currentPanY = panY.get();

      const scaleRatio = nextScale / currentScale;

      const newPanX = mouseX - (mouseX - currentPanX) * scaleRatio;
      const newPanY = mouseY - (mouseY - currentPanY) * scaleRatio;

      panX.set(newPanX);
      panY.set(newPanY);
      zoom.set(nextScale);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [zoom, panX, panY]);

  const isItemVisible = (item: GalleryItem) => {
    if (!activeCategories || activeCategories.length === 0) {
      return true;
    }

    return activeCategories.includes(item.category);
  };

  const handleTileClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!viewportWidth || !viewportHeight) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const tileCenterX = rect.left + rect.width / 2;
    const tileCenterY = rect.top + rect.height / 2;

    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;

    const currentPanX = panX.get();
    const currentPanY = panY.get();
    const currentScale = zoom.get();

    const centeredPanX = currentPanX + (viewportCenterX - tileCenterX);
    const centeredPanY = currentPanY + (viewportCenterY - tileCenterY);

    const targetScale = Math.min(ZOOM_MAX, Math.max(currentScale, 1.2));
    const scaleRatio = currentScale === 0 ? 1 : targetScale / currentScale;

    const pivotX = viewportCenterX;
    const pivotY = viewportCenterY;

    const adjustedPanX = pivotX - (pivotX - centeredPanX) * scaleRatio;
    const adjustedPanY = pivotY - (pivotY - centeredPanY) * scaleRatio;

    panX.set(adjustedPanX);
    panY.set(adjustedPanY);
    zoom.set(targetScale);

    // After the click + zoom, treat this as the new origin for cursor-based
    // panning so the user can keep exploring from here without snapping back.
    setOriginPan({ x: adjustedPanX, y: adjustedPanY });
  };

  return (
    <ViewportFrame>
      <CanvasSurface
        style={{
          x: panX,
          y: panY,
          scale: zoom,
        }}
      >
        <CanvasInner>
          {rows.map((row) => (
            <Row key={row.index} layout>
              <AnimatePresence initial={false}>
                {row.items.filter(isItemVisible).map((item) => (
                  <Tile
                    key={item.id}
                    layout
                    layoutId={item.id}
                    $aspect={item.aspectRatio}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={MOTION_CONFIG.tileTransition}
                    onClick={handleTileClick}
                  >
                    <TileInner>
                      <BaseImageLayer className="image-colour-base">
                        <Image
                          src={getPlaceholderSrc(item, "low")}
                          alt={`${item.category} placeholder (base)`}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="5vw"
                        />
                      </BaseImageLayer>

                      <HighResImageLayer className="high-res-image-layer">
                        <Image
                          src={getPlaceholderSrc(item, "high")}
                          alt={`${item.category} placeholder`}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="15vw"
                        />
                      </HighResImageLayer>
                    </TileInner>
                  </Tile>
                ))}
              </AnimatePresence>
            </Row>
          ))}
        </CanvasInner>
      </CanvasSurface>
    </ViewportFrame>
  );
};

export default Canvas;
