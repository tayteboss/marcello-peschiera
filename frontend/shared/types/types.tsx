export type MediaType = {
  mediaType: "video" | "image";
  video?: {
    asset?: { playbackId?: string };
    videoLink?: string;
  };
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
  thumbnailImage?: {
    asset: {
      url: string;
      metadata: {
        lqip: string;
        dimensions?: {
          aspectRatio?: number;
          width?: number;
          height?: number;
        };
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

export type SlugType = {
  current: string;
};

export type SiteSettingsType = {
  referenceTitle?: string;
  seoTitle?: string;
  seoDescription?: string;
  biography?: string;
  phone?: string;
  email?: string;
  instagramHandle?: string;
  instagramLink?: string;
};

export type ProjectType = {
  _id: string;
  title: string;
  type: "photography" | "cinematography" | "direction";
  media: MediaType;
  slug: SlugType;
};
