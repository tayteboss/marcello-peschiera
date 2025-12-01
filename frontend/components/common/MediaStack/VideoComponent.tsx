import MuxPlayer from "@mux/mux-player-react/lazy";
import styled from "styled-components";
import { MediaType } from "../../../shared/types/types";

const VideoComponentWrapper = styled.div`
  position: relative;
  overflow: hidden;

  mux-player {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  const posterUrl = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.png?width=214&height=121&time=1`
    : undefined;

  return (
    <VideoComponentWrapper
      className="media-wrapper"
      style={aspectPadding ? { paddingTop: aspectPadding } : undefined}
    >
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
          poster={posterUrl}
          minResolution={minResolution}
          paused={!(inView && shouldPlay)}
        />
      )}
    </VideoComponentWrapper>
  );
};

export default VideoComponent;
