import Image from "next/image";
import { useMemo, useRef } from "react";
import styled from "styled-components";
import {
  Canvas as FlowscapeCanvas,
  NodeView,
  CanvasNode,
  useCanvasNavigation,
} from "@flowscape-ui/canvas-react";
import { AnimatePresence, motion } from "framer-motion";
import { useGalleryFilter } from "../../../shared/context/context";

const InfiniteCanvas2Wrapper = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
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
  width: 100%;
  height: 100%;
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

type GalleryPatternItem = Pick<GalleryItem, "category" | "aspectRatio">;

// Same circular row layout as the main canvas: middle row is widest.
const ROW_ITEM_COUNTS = [
  2, 4, 6, 8, 10, 12, 14, 16, 18, 16, 14, 12, 10, 8, 6, 4, 2,
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

const buildNodes = (): CanvasNode[] => {
  const TILE_WIDTH = 220;
  const TILE_HEIGHT = 180;
  const GAP_X = 24;
  const ROW_SPACING = 220;
  const midRowIndex = (ROW_COUNT - 1) / 2;

  const nodes: CanvasNode[] = [];

  ROW_ITEM_COUNTS.forEach((count, rowIndex) => {
    const totalWidth = count * TILE_WIDTH + (count - 1) * GAP_X;
    const startX = -totalWidth / 2;
    const y = (rowIndex - midRowIndex) * ROW_SPACING;

    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      const id = `row-${rowIndex}-item-${itemIndex}`;

      const category =
        CATEGORY_SEQUENCE[(rowIndex + itemIndex) % CATEGORY_SEQUENCE.length];
      const aspectRatio =
        ASPECT_SEQUENCE[(rowIndex + itemIndex) % ASPECT_SEQUENCE.length];

      const item: GalleryItem = {
        id,
        row: rowIndex,
        category,
        aspectRatio,
      };

      const x = startX + itemIndex * (TILE_WIDTH + GAP_X);

      nodes.push({
        id,
        x,
        y,
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        data: item,
      } as CanvasNode);
    }
  });

  return nodes;
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

const InfiniteCanvas2 = () => {
  const { activeCategories } = useGalleryFilter();
  const allNodes: CanvasNode[] = useMemo(buildNodes, []);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Let canvas-react handle smooth zoom & pan around the cursor.
  useCanvasNavigation(canvasRef, {
    // Make interaction feel like a typical zoomable canvas:
    // - scroll wheel zooms in/out directly
    // - left mouse button pans the world
    wheelBehavior: "zoom",
    wheelZoom: true,
    wheelModifier: "none",
    panButton: 0,
    panModifier: "none",
    mouseZoomSensitivityIn: 0.0015,
    mouseZoomSensitivityOut: 0.0015,
    touchpadZoomSensitivityIn: 0.0015,
    touchpadZoomSensitivityOut: 0.0015,
    mousePanScale: 1.2,
    touchpadPanScale: 0.9,
    doubleClickZoom: true,
    doubleClickZoomFactor: 2,
    doubleClickZoomOut: true,
    doubleClickZoomOutModifier: "alt",
    doubleClickZoomOutFactor: 2,
    keyboardPan: true,
    keyboardPanStep: 50,
    keyboardPanSlowStep: 25,
  });

  const isItemVisible = (item: GalleryItem) => {
    if (!activeCategories || activeCategories.length === 0) {
      return true;
    }

    return activeCategories.includes(item.category);
  };

  const visibleNodes = useMemo(
    () =>
      allNodes.filter((node) => {
        const data = node.data as GalleryItem | undefined;
        if (!data) return true;
        return isItemVisible(data);
      }),
    [allNodes, activeCategories]
  );

  return (
    <InfiniteCanvas2Wrapper>
      <FlowscapeCanvas
        ref={canvasRef}
        nodes={visibleNodes}
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
        }}
      >
        <AnimatePresence initial={false}>
          {visibleNodes.map((node) => {
            const data = node.data as GalleryItem | undefined;
            if (!data) return null;

            const imageItem = data;

            return (
              <NodeView key={node.id} node={node} unstyled>
                <Tile
                  layout
                  layoutId={imageItem.id}
                  $aspect={imageItem.aspectRatio}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <TileInner>
                    <BaseImageLayer className="image-colour-base">
                      <Image
                        src={getPlaceholderSrc(imageItem, "low")}
                        alt={`${imageItem.category} placeholder (base)`}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="5vw"
                      />
                    </BaseImageLayer>

                    <HighResImageLayer className="high-res-image-layer">
                      <Image
                        src={getPlaceholderSrc(imageItem, "high")}
                        alt={`${imageItem.category} placeholder`}
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="15vw"
                      />
                    </HighResImageLayer>
                  </TileInner>
                </Tile>
              </NodeView>
            );
          })}
        </AnimatePresence>
      </FlowscapeCanvas>
    </InfiniteCanvas2Wrapper>
  );
};

export default InfiniteCanvas2;
