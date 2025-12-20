import styled from "styled-components";
import ImageComponent from "./ImageComponent";
import VideoComponent from "./VideoComponent";
import { MediaType } from "../../../shared/types/types";

const MediaStackWrapper = styled.div`
  width: 100%;
  height: 100%;
`;

type Props = {
  data: MediaType;
  isPriority?: boolean;
  noFadeInAnimation?: boolean;
  sizes?: undefined | string;
  alt?: string;
  lazyLoad?: boolean;
  minResolution?: undefined | "2160p" | "1440p" | "1080p" | "720p" | "480p";
  useImageParallax?: boolean;
  useMobileData?: MediaType;
  aspectPadding?: string;
  shouldPlayVideo?: boolean;
  onReady?: () => void;
  onPlaybackStart?: () => void;
};

const MediaStack = (props: Props) => {
  const {
    data,
    isPriority = false,
    noFadeInAnimation = false,
    sizes = undefined,
    alt,
    lazyLoad = false,
    minResolution = "2160p",
    useImageParallax = false,
    useMobileData,
    aspectPadding,
    shouldPlayVideo,
    onReady,
    onPlaybackStart,
  } = props ?? {};

  // sizes="(max-width: 768px) 38vw, (max-width: 1024px) 20vw, 15vw"

  const useVideo = data?.mediaType === "video";
  // This project only uses MediaStack inside the infinite canvas tiles.
  // IntersectionObserver adds measurable overhead when there can be ~200 tiles,
  // and isn't needed here because:
  // - Images can rely on Next/Image's native lazy-loading.
  // - Videos are only mounted when hovered/active (so they're necessarily visible).
  const inView = true;

  return (
    <MediaStackWrapper className="media-stack-wrapper">
      {useVideo && (
        <VideoComponent
          data={data}
          useMobileData={useMobileData}
          inView={inView}
          isPriority={isPriority}
          noFadeInAnimation={noFadeInAnimation}
          lazyLoad={lazyLoad}
          minResolution={minResolution}
          aspectPadding={aspectPadding}
          shouldPlay={shouldPlayVideo}
          onReady={onReady}
          onPlaybackStart={onPlaybackStart}
        />
      )}
      {!useVideo && (
        <ImageComponent
          data={data}
          useMobileData={useMobileData}
          isPriority={isPriority}
          inView={inView}
          noFadeInAnimation={noFadeInAnimation}
          sizes={sizes}
          alt={alt}
          lazyLoad={lazyLoad}
          useImageParallax={useImageParallax}
          aspectPadding={aspectPadding}
          onReady={onReady}
        />
      )}
    </MediaStackWrapper>
  );
};

export default MediaStack;
