import MuxPlayer from "@mux/mux-player-react/lazy";
import styled from "styled-components";
import { MediaType } from "../../../shared/types/types";

const VideoComponentWrapper = styled.div`
  position: relative;
  overflow: hidden;
  pointer-events: none;
  background: #000;

  mux-player {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: none;
  }

  mux-player,
  img {
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

  const videoLink = data?.video?.videoLink;

  const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
      if (
        parsed.hostname.includes("youtube.com") &&
        parsed.searchParams.get("v")
      ) {
        const id = parsed.searchParams.get("v");
        return id
          ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${id}`
          : null;
      }

      // Short URL: https://youtu.be/VIDEO_ID
      if (parsed.hostname === "youtu.be") {
        const id = parsed.pathname.replace("/", "");
        return id
          ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&playlist=${id}`
          : null;
      }

      // Already an embed URL – pass through.
      if (parsed.pathname.startsWith("/embed/")) {
        return url;
      }
    } catch {
      return null;
    }
    return null;
  };

  const getVimeoEmbedUrl = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      // Standard URL: https://vimeo.com/VIDEO_ID
      if (parsed.hostname.includes("vimeo.com")) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        const id = parts[parts.length - 1];
        if (!id) return null;
        return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`;
      }
    } catch {
      return null;
    }
    return null;
  };

  const resolveEmbedUrl = (url?: string | null): string | null => {
    if (!url) return null;
    const yt = getYouTubeEmbedUrl(url);
    if (yt) return yt;
    const vimeo = getVimeoEmbedUrl(url);
    if (vimeo) return vimeo;
    return null;
  };

  const embedUrl = resolveEmbedUrl(videoLink ?? null);

  const posterUrl = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.png?width=214&height=121&time=1`
    : undefined;

  return (
    <VideoComponentWrapper
      className="media-wrapper"
      style={aspectPadding ? { paddingTop: aspectPadding } : undefined}
    >
      {embedUrl && (
        <iframe
          src={embedUrl}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading={lazyLoad ? "lazy" : "eager"}
          title="Embedded video"
        />
      )}
      {!embedUrl && playbackId && (
        <MuxPlayer
          streamType="on-demand"
          playbackId={playbackId}
          loop={true}
          thumbnailTime={1}
          loading={lazyLoad ? "viewport" : "page"}
          preload="auto"
          muted
          playsInline={true}
          poster={posterUrl}
          minResolution={minResolution}
          paused={!(inView && shouldPlay)}
        />
      )}
    </VideoComponentWrapper>
  );
};

export default VideoComponent;
