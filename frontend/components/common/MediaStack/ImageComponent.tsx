import Image from "next/image";
import styled from "styled-components";
import { useEffect, useRef } from "react";
import { MediaType } from "../../../shared/types/types";

const ImageComponentWrapper = styled.div`
  position: relative;
  overflow: hidden;
  background: var(--colour-cream);

  mux-player,
  img {
    display: block;
    object-fit: cover;
  }
`;

// Note: previous versions of this component supported parallax and blur
// placeholder effects using framer-motion. To keep the infinite canvas as
// lightweight and performant as possible, we've removed those effects and now
// render a single static image only.

type Props = {
  data: MediaType;
  useMobileData?: MediaType;
  isPriority?: boolean;
  inView: boolean;
  noFadeInAnimation?: boolean;
  sizes: string | undefined;
  alt?: string;
  lazyLoad?: boolean;
  useImageParallax?: boolean;
  // Total parallax travel as a percentage of container height (e.g., 20 => image moves ±10%)
  parallaxStrength?: number;
  aspectPadding?: string;
  onReady?: () => void;
};

const ImageComponent = (props: Props) => {
  const {
    data,
    useMobileData,
    isPriority = false,
    inView,
    noFadeInAnimation = false,
    sizes,
    alt,
    lazyLoad,
    useImageParallax = false,
    parallaxStrength = 20,
    aspectPadding,
    onReady,
  } = props;

  // Set responsive image sizes
  // On mobile, the image should take up 38% of the viewport width
  // On tablet, the image should take up 20% of the viewport width
  // On desktop, the image should take up 15% of the viewport width
  // sizes="(max-width: 768px) 38vw, (max-width: 1024px) 20vw, 15vw"

  const imageUrl = useMobileData?.image?.asset?.url ?? data?.image?.asset?.url;
  const imageAltText = alt || data?.image?.alt || "Visual media content";
  const isFallback = !imageUrl;
  const resolvedImageUrl = imageUrl ?? "/placeholder.jpg";
  const resolvedAltText = imageUrl ? imageAltText : "";
  const loadingStrategy = isPriority
    ? "eager"
    : lazyLoad === false
      ? "eager"
      : "lazy";
  const readyCalledRef = useRef(false);

  useEffect(() => {
    readyCalledRef.current = false;
  }, [resolvedImageUrl]);

  return (
    <ImageComponentWrapper
      className="media-wrapper"
      style={aspectPadding ? { paddingTop: aspectPadding } : undefined}
    >
      <Image
        src={resolvedImageUrl}
        alt={resolvedAltText}
        priority={isPriority}
        fill
        style={{
          objectFit: "cover",
          ...(isFallback ? { filter: "brightness(0)" } : null),
        }}
        sizes={sizes}
        loading={loadingStrategy}
        onLoad={() => {
          if (readyCalledRef.current) return;
          readyCalledRef.current = true;
          onReady?.();
        }}
      />
    </ImageComponentWrapper>
  );
};

export default ImageComponent;
