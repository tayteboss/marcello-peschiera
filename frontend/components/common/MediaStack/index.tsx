import styled from "styled-components";
import { useInView } from "react-intersection-observer";
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
  } = props ?? {};

  // sizes="(max-width: 768px) 38vw, (max-width: 1024px) 20vw, 15vw"

  const useVideo = data?.mediaType === "video";

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.2,
    rootMargin: "-5%",
  });

  return (
    <MediaStackWrapper ref={ref} className="media-stack-wrapper">
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
        />
      )}
    </MediaStackWrapper>
  );
};

export default MediaStack;
