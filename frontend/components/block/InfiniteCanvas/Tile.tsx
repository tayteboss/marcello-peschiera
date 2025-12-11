import Image from "next/image";
import { MouseEvent, useEffect, useState, memo, useRef } from "react";
import styled from "styled-components";

import { FilterCategory } from "../../../shared/context/context";
import MediaStack from "../../common/MediaStack";
import { MediaType } from "@/shared/types/types";

const DESKTOP_TILE_HEIGHT_VW = 15;
const MOBILE_TILE_HEIGHT_VW = 32; // Double the height percentage for mobile since cols are halved

const TileRoot = styled.div<{
  $isVisible: boolean;
  $aspectRatio: string;
  $widthFactor: number;
  $isMobile: boolean;
}>`
  position: relative;
  height: ${(props) =>
    props.$isMobile
      ? `${MOBILE_TILE_HEIGHT_VW}vw`
      : `${DESKTOP_TILE_HEIGHT_VW}vw`};
  width: ${({ $widthFactor, $isMobile }) =>
    $isMobile
      ? `${MOBILE_TILE_HEIGHT_VW * ($widthFactor || 1)}vw`
      : `${DESKTOP_TILE_HEIGHT_VW * ($widthFactor || 1)}vw`};
  opacity: ${(props) => (props.$isVisible ? 1 : 0)};
  pointer-events: ${(props) => (props.$isVisible ? "auto" : "none")};
  transition: opacity var(--transition-speed-default) var(--transition-ease);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: pointer !important;

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
  tileIndex: number;
  isMobile?: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>, tileIndex: number) => void;
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
    tileIndex,
    isMobile = false,
    onClick,
    onMouseDown,
  }: InfiniteCanvasTileProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
      null
    );

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

    // When a tile transitions from active -> inactive (because another tile
    // was clicked), clear any latched hover state so the high-res content
    // is only shown for the currently active tile.
    useEffect(() => {
      if (!isActive) {
        setIsHovered(false);
      }
    }, [isActive]);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Consider it a tap if movement is less than 10px and time is less than 300ms
      if (distance < 10 && deltaTime < 300) {
        // Create a synthetic mouse event for the onClick handler
        const syntheticEvent = {
          ...e,
          currentTarget: e.currentTarget,
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation(),
        } as unknown as MouseEvent<HTMLDivElement>;

        onClick(syntheticEvent, tileIndex);
      }

      touchStartRef.current = null;
    };

    return (
      <TileRoot
        onClick={(e) => onClick(e, tileIndex)}
        onMouseDown={onMouseDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
        $isMobile={isMobile}
      >
        <TileInner
          $isActive={isActive}
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
                    sizes={isMobile ? "15vw" : "10vw"}
                    loading="lazy"
                  />
                ) : (
                  <MediaStack
                    data={media}
                    alt={title ?? media.image?.alt ?? ""}
                    sizes={isMobile ? "15vw" : "10vw"}
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
                  sizes={isMobile ? "80vw" : "40vw"}
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
