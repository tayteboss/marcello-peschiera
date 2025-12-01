import Image from "next/image";
import { MouseEvent, useEffect, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";

import { FilterCategory } from "../../../shared/context/context";
import MediaStack from "../../common/MediaStack";
import { MediaType } from "@/shared/types/types";

const TILE_HEIGHT_VW = 12;
const TILE_HEIGHT = `${TILE_HEIGHT_VW}vw`;

const TileRoot = styled(motion.div)<{
  $isVisible: boolean;
  $isDragging: boolean;
  $isPanning: boolean;
  $aspectRatio: string;
  $widthFactor: number;
}>`
  position: relative;
  height: ${TILE_HEIGHT};
  width: ${({ $widthFactor }) => `${TILE_HEIGHT_VW * ($widthFactor || 1)}vw`};
  opacity: ${(props) => (props.$isVisible ? 1 : 0)};
  pointer-events: ${(props) =>
    props.$isVisible && !props.$isPanning ? "auto" : "none"};
  transition: opacity var(--transition-speed-default) var(--transition-ease);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: ${(props) => (props.$isDragging ? "grabbing" : "pointer")};
  overflow: hidden;

  .media-wrapper {
    height: 100%;
  }

  img {
    pointer-events: none;
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
}>`
  position: relative;
  width: 100%;
  height: 100%;
`;

export type InfiniteCanvasTileProps = {
  index: number;
  category: FilterCategory;
  aspectRatio: string;
  isVisible: boolean;
  isDragging: boolean;
  isPanning: boolean;
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
  isPanning,
  isActive,
  media,
  title,
  aspectPadding,
  widthFactor = 1,
  onClick,
  onMouseDown,
}: InfiniteCanvasTileProps) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // When the canvas is panning (wheel/drag inertia), force-clear any hover
    // state so we don't keep tiles visually "active" under the cursor while
    // the grid is moving. Keep active tiles latched.
    if (isPanning && !isActive) {
      setIsHovered(false);
    }
  }, [isPanning, isActive]);

  const isVideo = media?.mediaType === "video";
  const thumbnailImage = isVideo
    ? (media?.thumbnailImage ?? media?.image)
    : undefined;

  // A tile is considered "high-res active" whenever it's either hovered or
  // fully active (clicked). For video tiles, this should latch playback so
  // the video continues even after hover ends until the active tile is
  // cleared by panning or another tile is activated.
  const isHighResOn = isActive || isHovered;
  const isVideoActive = isVideo && isHighResOn;
  const shouldPlayVideo = isVideoActive;

  return (
    <TileRoot
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => {
        // Avoid hover churn while the user is actively dragging/panning
        // the canvas. Only allow hover when the grid is stationary.
        if (!isDragging && !isPanning) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        // Only clear hover when the tile is not active. For active tiles
        // (especially videos), we want the visual "hover" styling and
        // high-res content to remain even after the pointer leaves.
        if (!isActive) {
          setIsHovered(false);
        }
      }}
      $isVisible={isVisible}
      $isDragging={isDragging}
      $isPanning={isPanning}
      $aspectRatio={aspectRatio}
      $widthFactor={widthFactor}
    >
      <TileInner
        layout
        $isActive={isActive}
        // Mirror the global `.remove-duotone` behaviour locally: when a tile
        // is high-res active (hovered or clicked), fade out the duotone base
        // layer and reveal the high-res image/video layer.
        className={isHighResOn ? "remove-duotone" : undefined}
      >
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
                sizes="40vw"
                lazyLoad
                noFadeInAnimation
                // For videos, only start loading/playing when the tile is
                // interacted with to avoid decoding many streams at once.
                shouldPlayVideo={shouldPlayVideo}
                minResolution="720p"
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
    </TileRoot>
  );
};
