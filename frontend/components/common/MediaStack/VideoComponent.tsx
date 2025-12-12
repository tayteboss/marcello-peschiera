import MuxPlayer from "@mux/mux-player-react/lazy";
import styled from "styled-components";
import ReactPlayer from "react-player";
import Image from "next/image";
import { MediaType } from "../../../shared/types/types";

const VideoComponentWrapper = styled.div`
  position: relative;
  overflow: hidden;
  pointer-events: none;
  background: #000;
  width: 100%;
  height: 100%;

  mux-player {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .react-player {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    z-index: 1;
    pointer-events: none;
  }

  /* ReactPlayer may wrap the underlying iframe/video in extra divs. */
  .react-player > div,
  .react-player iframe,
  .react-player video {
    width: 100% !important;
    height: 100% !important;
  }

  .react-player video {
    object-fit: cover;
  }

  mux-player,
  img,
  .react-player {
    transition: all var(--transition-speed-extra-slow) var(--transition-ease);
  }
`;

type Props = {
  data: MediaType;
  useMobileData?: MediaType;
  inView: boolean;
  isPriority: boolean;
  noFadeInAnimation?: boolean;
  lazyLoad?: boolean;
  minResolution?: undefined | "2160p" | "1440p" | "1080p" | "720p" | "480p";
  aspectPadding?: string;
  shouldPlay?: boolean;
};

const normalizeExternalVideoUrl = (url: unknown): string | undefined => {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Support protocol-relative urls ("//youtube.com/...")
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  // If CMS provides "www.youtube.com/..." without scheme, add https.
  if (
    /^www\./i.test(trimmed) ||
    /^(youtube\.com|youtu\.be|vimeo\.com)\//i.test(trimmed)
  ) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

const VideoComponent = (props: Props) => {
  const {
    data,
    useMobileData,
    inView,
    isPriority,
    noFadeInAnimation,
    lazyLoad,
    minResolution,
    aspectPadding,
    shouldPlay = false,
  } = props;
  // Prefer mobile-specific video data when provided, otherwise fall back to
  // the main video. This avoids any window-size tracking and keeps the
  // component lightweight.
  const playbackId =
    useMobileData?.video?.asset?.playbackId ?? data?.video?.asset?.playbackId;

  const videoLink = normalizeExternalVideoUrl(data?.video?.videoLink);

  const thumbnailUrl =
    useMobileData?.thumbnailImage?.asset?.url ??
    useMobileData?.image?.asset?.url ??
    data?.thumbnailImage?.asset?.url ??
    data?.image?.asset?.url;

  const posterUrl = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.png?width=214&height=121&time=1`
    : undefined;

  const resolvedPosterUrl = posterUrl ?? thumbnailUrl ?? "/placeholder.jpg";
  const isPlaceholderPoster = resolvedPosterUrl === "/placeholder.jpg";

  // Configuration to strip UI and ensure performance
  const playerConfig: any = {
    youtube: {
      playerVars: {
        autoplay: 1,
        mute: 1,
        fs: 0,
        controls: 0,
        showinfo: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        disablekb: 1,
        playsinline: 1,
      },
    },
    vimeo: {
      playerOptions: {
        background: true,
        controls: false,
        title: false,
        byline: false,
        portrait: false,
      },
    },
    file: {
      attributes: {
        controls: false,
        muted: true,
        playsInline: true,
        "webkit-playsinline": "true",
        "x5-playsinline": "true",
      },
    },
  };

  // Critical: only *mount* ReactPlayer when we actually intend to play.
  // Otherwise YouTube/Vimeo will load for every in-view tile which is heavy.
  const shouldRenderPlayer =
    !playbackId && !!videoLink && (!lazyLoad || inView) && !!shouldPlay;

  return (
    <VideoComponentWrapper
      className="media-wrapper"
      style={aspectPadding ? { paddingTop: aspectPadding } : undefined}
    >
      <Image
        src={resolvedPosterUrl}
        alt=""
        fill
        style={{
          objectFit: "cover",
          ...(isPlaceholderPoster ? { filter: "brightness(0)" } : null),
        }}
        sizes="100vw"
        loading={lazyLoad ? "lazy" : "eager"}
      />
      {shouldRenderPlayer && (
        <ReactPlayer
          className="react-player"
          src={videoLink}
          playing={inView && shouldPlay}
          loop={true}
          muted={true}
          controls={false}
          width="100%"
          height="100%"
          config={playerConfig}
          playsInline={true}
          style={{ pointerEvents: "none" }}
          onReady={() => console.log("ReactPlayer ready", videoLink)}
          onStart={() => console.log("ReactPlayer started", videoLink)}
          onPlay={() => console.log("ReactPlayer playing", videoLink)}
          onPause={() => console.log("ReactPlayer paused", videoLink)}
          onError={(e: any) => console.error("ReactPlayer error", e)}
        />
      )}
      {playbackId && (
        <MuxPlayer
          streamType="on-demand"
          playbackId={playbackId}
          loop={true}
          thumbnailTime={1}
          loading={lazyLoad ? "viewport" : "page"}
          preload="auto"
          muted
          playsInline={true}
          poster={resolvedPosterUrl}
          minResolution={minResolution}
          paused={!(inView && shouldPlay)}
        />
      )}
    </VideoComponentWrapper>
  );
};

export default VideoComponent;
