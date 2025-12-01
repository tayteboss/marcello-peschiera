import Image from "next/image";
import { MouseEvent, useState, memo } from "react";
import styled from "styled-components";

import { FilterCategory } from "../../../shared/context/context";
import MediaStack from "../../common/MediaStack";
import { MediaType } from "@/shared/types/types";

const TILE_HEIGHT_VW = 12;
const TILE_HEIGHT = `${TILE_HEIGHT_VW}vw`;

const TileRoot = styled.div<{
  $isVisible: boolean;
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
  cursor: pointer;
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

const TileInner = styled.div<{
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
  isActive: boolean;
  media?: MediaType;
  title?: string;
  aspectPadding?: string;
  widthFactor?: number;
  tileId: string;
  onClick: (event: MouseEvent<HTMLDivElement>, tileId: string) => void;
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
};

export const InfiniteCanvasTile = memo(
  ({
    index,
    category,
    aspectRatio,
    isVisible,
    isActive,
    media,
    title,
    aspectPadding,
    widthFactor = 1,
    tileId,
    onClick,
    onMouseDown,
  }: InfiniteCanvasTileProps) => {
    const [isHovered, setIsHovered] = useState(false);

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
        onClick={(e) => onClick(e, tileId)}
        onMouseDown={onMouseDown}
        onMouseEnter={() => {
          // CSS pointer-events: none on parent handles panning interactions.
          setIsHovered(true);
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
        $aspectRatio={aspectRatio}
        $widthFactor={widthFactor}
      >
        <TileInner
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
                    sizes="25vw"
                    loading="lazy"
                  />
                ) : (
                  <MediaStack
                    data={media}
                    alt={title ?? media.image?.alt ?? ""}
                    sizes="25vw"
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
  }
);

InfiniteCanvasTile.displayName = "InfiniteCanvasTile";
