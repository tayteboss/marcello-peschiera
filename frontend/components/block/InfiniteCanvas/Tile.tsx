import Image from "next/image";
import { MouseEvent, useEffect, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";

import { useInView } from "../../../hooks/useInView";
import { FilterCategory } from "../../../shared/context/context";

const TILE_HEIGHT_VW = 10;
const TILE_HEIGHT = `${TILE_HEIGHT_VW}vw`;

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

const TileRoot = styled(motion.div)<{
  $isVisible: boolean;
  $isDragging: boolean;
  $aspectRatio: string;
}>`
  aspect-ratio: ${(props) => props.$aspectRatio};
  position: relative;
  width: auto;
  height: ${TILE_HEIGHT};
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

const TileInner = styled(motion.div)<{
  $isActive: boolean;
  $isHovered: boolean;
}>`
  position: relative;
  width: 100%;
  height: 100%;

  .high-res-image-layer {
    opacity: ${(props) => (props.$isActive || props.$isHovered ? 1 : 0)};
  }
`;

export type InfiniteCanvasTileProps = {
  index: number;
  category: FilterCategory;
  aspectRatio: string;
  isVisible: boolean;
  isDragging: boolean;
  isActive: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
};

export const InfiniteCanvasTile = ({
  index,
  category,
  aspectRatio,
  isVisible,
  isDragging,
  isActive,
  onClick,
  onMouseDown,
}: InfiniteCanvasTileProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const [ref, inView] = useInView({
    rootMargin: "300px",
    threshold: 0,
  });

  // When the canvas pans (scroll / drag), clear any local hover state so tiles
  // that move away from the cursor don't stay visually "hovered".
  // However, don't clear hover if the tile is currently active (clicked).
  useEffect(() => {
    const handlePan = () => {
      if (!isActive) {
        setIsHovered(false);
      }
    };

    window.addEventListener("infiniteCanvasPan", handlePan);
    return () => {
      window.removeEventListener("infiniteCanvasPan", handlePan);
    };
  }, [isActive]);

  return (
    <TileRoot
      ref={ref}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        // Don't clear hover state if tile is active (clicked)
        if (!isActive) {
          setIsHovered(false);
        }
      }}
      $isVisible={isVisible}
      $isDragging={isDragging}
      $aspectRatio={aspectRatio}
    >
      {inView && (
        <TileInner layout $isActive={isActive} $isHovered={isHovered}>
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
    </TileRoot>
  );
};
