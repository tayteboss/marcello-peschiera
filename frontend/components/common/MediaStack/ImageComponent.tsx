import Image from "next/image";
import styled from "styled-components";
import { MediaType } from "../../../shared/types/types";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  easeIn,
  easeOut,
} from "framer-motion";
import { useState, useEffect, useRef } from "react";
import useWindowDimensions from "../../../hooks/useWindowDimensions";

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

const MotionDivBase = styled(motion.div)`
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
`;

const InnerBlurWrapper = styled(MotionDivBase)`
  z-index: 2;
`;

const InnerMainImageWrapper = styled(MotionDivBase)`
  z-index: 1;
`;

const placeholderVariants = {
  visible: {
    opacity: 1,
    scale: 1,
  },

  exit: {
    opacity: 0,
    scale: 1,
    transition: { duration: 0.4, ease: easeIn },
  },
};

const mainImageVariants = {
  initial: {
    scale: 1.02,
  },
  animate: {
    scale: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
};

// Variants for when parallax is enabled (avoid scale conflicts; handle only opacity/blur)
const mainImageParallaxVariants = {
  initial: {},
  animate: {
    transition: { duration: 0.4, ease: easeOut },
  },
};

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
  } = props;

  // Set responsive image sizes
  // On mobile, the image should take up 38% of the viewport width
  // On tablet, the image should take up 20% of the viewport width
  // On desktop, the image should take up 15% of the viewport width
  // sizes="(max-width: 768px) 38vw, (max-width: 1024px) 20vw, 15vw"

  const isMobile = useWindowDimensions().width < 768 && !!useMobileData;

  const imageUrl = isMobile
    ? useMobileData?.image?.asset?.url
    : data?.image?.asset?.url;
  const blurDataURL = isMobile
    ? useMobileData?.image?.asset?.metadata?.lqip
    : data?.image?.asset?.metadata?.lqip;
  const imageAltText = alt || data?.image?.alt || "Visual media content";
  const loadingStrategy = isPriority
    ? "eager"
    : lazyLoad === false
      ? "eager"
      : "lazy";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollY } = useScroll();
  const [scrollBounds, setScrollBounds] = useState<{
    start: number;
    end: number;
    height: number;
  }>({ start: 0, end: 1, height: 0 });

  useEffect(() => {
    const recalc = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || window.pageYOffset;
      const start = scrollTop + rect.top - window.innerHeight;
      const end = scrollTop + rect.bottom;
      setScrollBounds({ start, end, height: rect.height });
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [imageUrl]);

  // Compute amplitude in px based on container height and strength percentage
  const startVal = scrollBounds.start;
  const endVal = scrollBounds.end > startVal ? scrollBounds.end : startVal + 1;
  const containerHeight = scrollBounds.height || 0;
  const strengthFraction = Math.max(0, parallaxStrength) / 100;
  // Total travel is strength%, so amplitude is half that
  const amplitudePx = useImageParallax
    ? (containerHeight * strengthFraction) / 2
    : 0;
  // Ensure the image always covers when moved by amplitude: scale >= 1 + totalExtraHeight
  const parallaxScale = useImageParallax ? 1 + strengthFraction : 1;
  const parallaxY = useTransform(
    scrollY,
    [startVal, endVal],
    [-amplitudePx, amplitudePx]
  );

  const [isMainImageLoaded, setIsMainImageLoaded] = useState(noFadeInAnimation);

  useEffect(() => {
    // Reset 'isMainImageLoaded' to its initial state (based on noFadeInAnimation)
    // if the image URL changes. This ensures new images show their placeholders.
    setIsMainImageLoaded(noFadeInAnimation);
  }, [imageUrl, noFadeInAnimation]);

  const handleMainImageLoad = () => {
    if (!noFadeInAnimation) {
      setIsMainImageLoaded(true);
    }
  };

  // If noFadeInAnimation is true, render without fade/blur, but still support parallax.
  if (noFadeInAnimation) {
    return (
      <ImageComponentWrapper
        ref={containerRef}
        className="media-wrapper"
        style={aspectPadding ? { paddingTop: aspectPadding } : undefined}
      >
        {imageUrl &&
          (useImageParallax ? (
            <motion.div
              style={{
                y: parallaxY,
                scale: parallaxScale,
                position: "absolute",
                inset: 0,
                height: "100%",
                width: "100%",
              }}
            >
              <Image
                src={imageUrl}
                alt={imageAltText}
                priority={isPriority}
                fill
                style={{ objectFit: "cover" }}
                sizes={sizes}
                loading={loadingStrategy}
              />
            </motion.div>
          ) : (
            <Image
              src={imageUrl}
              alt={imageAltText}
              priority={isPriority}
              fill
              style={{ objectFit: "cover" }}
              sizes={sizes}
              loading={loadingStrategy}
            />
          ))}
        {/* Fallback to show static blur if no main image */}
        {!imageUrl && blurDataURL && (
          <Image
            src={blurDataURL}
            alt={imageAltText}
            priority={isPriority}
            fill
            style={{
              objectFit: "cover",
              transform: "scale(1.05)",
            }}
            sizes={sizes}
            loading="eager"
          />
        )}
      </ImageComponentWrapper>
    );
  }

  const shouldAnimateElements = inView || isPriority;

  return (
    <ImageComponentWrapper
      ref={containerRef}
      className="media-wrapper"
      style={aspectPadding ? { paddingTop: aspectPadding } : undefined}
    >
      <AnimatePresence>
        {shouldAnimateElements && blurDataURL && !isMainImageLoaded && (
          <InnerBlurWrapper
            key="placeholder"
            variants={placeholderVariants}
            initial="visible"
            animate="visible"
            exit="exit"
          >
            <Image
              src={blurDataURL}
              alt={`${imageAltText} (loading placeholder)`}
              priority={isPriority}
              fill
              style={{ objectFit: "cover" }}
              sizes={sizes}
              loading="eager"
            />
          </InnerBlurWrapper>
        )}
      </AnimatePresence>

      {imageUrl && (
        <InnerMainImageWrapper
          key="main-image-content"
          variants={
            useImageParallax ? mainImageParallaxVariants : mainImageVariants
          }
          initial="initial"
          animate={
            shouldAnimateElements && isMainImageLoaded ? "animate" : "initial"
          }
        >
          {useImageParallax ? (
            <motion.div
              style={{
                y: parallaxY,
                scale: parallaxScale,
                position: "absolute",
                inset: 0,
                height: "100%",
                width: "100%",
              }}
            >
              <Image
                src={imageUrl}
                alt={imageAltText}
                priority={isPriority}
                fill
                style={{ objectFit: "cover" }}
                sizes={sizes}
                loading={loadingStrategy}
                onLoad={handleMainImageLoad}
                onError={() => {
                  if (!noFadeInAnimation) setIsMainImageLoaded(true);
                }}
              />
            </motion.div>
          ) : (
            <Image
              src={imageUrl}
              alt={imageAltText}
              priority={isPriority}
              fill
              style={{ objectFit: "cover" }}
              sizes={sizes}
              loading={loadingStrategy}
              onLoad={handleMainImageLoad}
              onError={() => {
                if (!noFadeInAnimation) setIsMainImageLoaded(true);
              }}
            />
          )}
        </InnerMainImageWrapper>
      )}
    </ImageComponentWrapper>
  );
};

export default ImageComponent;
