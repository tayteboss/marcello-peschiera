import Image from "next/image";
import { MouseEvent, useEffect, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";

import { useInView } from "../../../hooks/useInView";
import { FilterCategory } from "../../../shared/context/context";
import MediaStack from "../../common/MediaStack";
import { MediaType } from "@/shared/types/types";

const TILE_HEIGHT_VW = 10;
const TILE_HEIGHT = `${TILE_HEIGHT_VW}vw`;

const TileRoot = styled(motion.div)<{
  $isVisible: boolean;
  $isDragging: boolean;
  $aspectRatio: string;
  $widthFactor: number;
}>`
  position: relative;
  height: ${TILE_HEIGHT};
  width: ${({ $widthFactor }) => `${TILE_HEIGHT_VW * ($widthFactor || 1)}vw`};
  opacity: ${(props) => (props.$isVisible ? 1 : 0)};
  pointer-events: ${(props) => (props.$isVisible ? "auto" : "none")};
  transition: opacity var(--transition-speed-default) var(--transition-ease);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "pointer")};

  .media-wrapper {
    height: 100%;
  }
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
  media?: MediaType;
  title?: string;
  aspectPadding?: string;
  widthFactor?: number;
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
  media,
  title,
  aspectPadding,
  widthFactor = 1,
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

  const isVideo = media?.mediaType === "video";
  const thumbnailImage = isVideo
    ? (media?.thumbnailImage ?? media?.image)
    : undefined;

  const shouldPlayVideo = isVideo && (isActive || isHovered);

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
      $widthFactor={widthFactor}
    >
      {inView && (
        <TileInner layout $isActive={isActive} $isHovered={isHovered}>
          {media ? (
            <>
              <BaseImageLayer className="image-colour-base">
                {isVideo && thumbnailImage?.asset?.url ? (
                  <Image
                    src={thumbnailImage.asset.url}
                    alt={title ?? thumbnailImage.alt ?? ""}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="1vw"
                    loading="lazy"
                  />
                ) : (
                  <MediaStack
                    data={media}
                    alt={title ?? media.image?.alt ?? ""}
                    sizes="1vw"
                    lazyLoad
                    noFadeInAnimation
                    shouldPlayVideo={false}
                  />
                )}
              </BaseImageLayer>

              <HighResImageLayer className="high-res-image-layer">
                <MediaStack
                  data={media}
                  alt={title ?? media.image?.alt ?? ""}
                  sizes="30vw"
                  lazyLoad
                  noFadeInAnimation
                  shouldPlayVideo={shouldPlayVideo}
                />
              </HighResImageLayer>
            </>
          ) : (
            <>
              <BaseImageLayer className="image-colour-base" />
              <HighResImageLayer className="high-res-image-layer" />
            </>
          )}
        </TileInner>
      )}
    </TileRoot>
  );
};
