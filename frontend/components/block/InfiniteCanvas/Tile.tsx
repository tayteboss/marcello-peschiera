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

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const Spinner = styled.div`
  width: 1em;
  height: 1em;
  border: 0.125em solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
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
  isDuotoneOff?: boolean;
  media?: MediaType;
  title?: string;
  aspectPadding?: string;
  widthFactor?: number;
  tileIndex: number;
  isMobile?: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>, tileIndex: number) => void;
};

export const InfiniteCanvasTile = memo(
  ({
    index,
    category,
    aspectRatio,
    isVisible,
    isActive,
    isDuotoneOff = false,
    media,
    title,
    aspectPadding,
    widthFactor = 1,
    tileIndex,
    isMobile = false,
    onClick,
  }: InfiniteCanvasTileProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isHighResReady, setIsHighResReady] = useState(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
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
    const isHighResOn = isActive || (!isMobile && isHovered);
    const isVideoActive = isVideo && isHighResOn;
    const shouldPlayVideo = isVideoActive;
    const shouldRenderHighRes = isVisible && (isHighResOn || isDuotoneOff);
    const shouldSwapToHighRes = (isHighResOn || isDuotoneOff) && isHighResReady;
    const showLoadingSpinner =
      isHighResOn && isVideo && shouldRenderHighRes && !isVideoPlaying;

    // When a tile transitions from active -> inactive (because another tile
    // was clicked), clear any latched hover state so the high-res content
    // is only shown for the currently active tile.
    useEffect(() => {
      if (!isActive) {
        setIsHovered(false);
      }
    }, [isActive]);

    // If the underlying media changes, reset readiness so we don't hide the base
    // layer until the new high-res asset is actually available.
    useEffect(() => {
      setIsHighResReady(false);
      setIsVideoPlaying(false);
    }, [
      media?.mediaType,
      media?.image?.asset?.url,
      media?.thumbnailImage?.asset?.url,
      media?.video?.asset?.playbackId,
      media?.video?.videoLink,
    ]);

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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => {
          if (isMobile) return;
          // CSS pointer-events: none on parent handles panning interactions.
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (isMobile) return;
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
          className={shouldSwapToHighRes ? "tile-remove-duotone" : undefined}
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
                    sizes={isMobile ? "5vw" : "5vw"}
                    loading="lazy"
                  />
                ) : (
                  <MediaStack
                    data={media}
                    alt={title ?? media.image?.alt ?? ""}
                    sizes={isMobile ? "5vw" : "5vw"}
                    lazyLoad
                    noFadeInAnimation
                    shouldPlayVideo={false}
                  />
                )}
              </BaseImageLayer>

              <HighResImageLayer className="high-res-image-layer">
                {shouldRenderHighRes ? (
                  <MediaStack
                    data={media}
                    alt={title ?? media.image?.alt ?? ""}
                    sizes={isMobile ? "80vw" : "30vw"}
                    // Mounting is already gated by hover/active; use eager loading
                    // here so the swap happens ASAP.
                    lazyLoad={false}
                    noFadeInAnimation
                    shouldPlayVideo={shouldPlayVideo}
                    minResolution="720p"
                    onReady={() => {
                      setIsHighResReady(true);
                    }}
                    onPlaybackStart={() => {
                      setIsVideoPlaying(true);
                    }}
                  />
                ) : null}
              </HighResImageLayer>
              {showLoadingSpinner ? (
                <LoadingOverlay aria-hidden="true">
                  <Spinner />
                </LoadingOverlay>
              ) : null}
            </>
          ) : (
            <>
              <BaseImageLayer className="image-colour-base">
                <Image
                  src="/placeholder.jpg"
                  alt=""
                  fill
                  style={{ objectFit: "cover", filter: "brightness(0)" }}
                  sizes={isMobile ? "15vw" : "5vw"}
                  loading="lazy"
                />
              </BaseImageLayer>
              <HighResImageLayer className="high-res-image-layer" />
            </>
          )}
        </TileInner>
      </TileRoot>
    );
  }
);

InfiniteCanvasTile.displayName = "InfiniteCanvasTile";
