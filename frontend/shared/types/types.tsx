export type MediaType = {
  mediaType: "video" | "image";
  video: { asset: { playbackId: string } };
  image: {
    asset: {
      url: string;
      metadata: {
        lqip: string;
        dimensions?: { aspectRatio?: number; width?: number; height?: number };
      };
    };
    alt: string;
  };
  caption?: string;
};

export type TransitionsType = {
  hidden: {
    opacity: number;
    transition: {
      duration: number;
    };
  };
  visible: {
    opacity: number;
    transition: {
      duration: number;
      delay?: number;
    };
  };
};

export type ButtonType = {
  url: string;
  pageReference: {
    _ref: string;
  };
  title: string;
};

export type SlugType = {
  current: string;
};

export type SiteSettingsType = {};

export type HomePageType = {
  seoTitle: string;
  seoDescription: string;
};

export type WorkPageType = {
  seoTitle: string;
  seoDescription: string;
};

export type ProjectType = {
  slug: SlugType;
};
