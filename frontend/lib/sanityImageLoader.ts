// ./sanityImageLoader.ts

// IMPORTANT: Replace these with your actual Sanity project ID and dataset
// You can find these in your Sanity project management console (sanity.io/manage)
const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const SANITY_DATASET = "production";

/**
 * Flexible Image Loader for Next.js Image component that handles both Sanity and Mux URLs.
 * @param {{ src: string, width: number, quality?: number }} params
 * @returns {string} The complete image URL with transformation parameters.
 */
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const url = new URL(src);

  // Handle Sanity CDN URLs
  if (url.hostname === "cdn.sanity.io") {
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "max");
    url.searchParams.set("w", width.toString());
    if (quality) {
      url.searchParams.set("q", quality.toString());
    }
    return url.toString();
  }

  // Handle Mux CDN URLs
  if (url.hostname === "image.mux.com") {
    // Mux URLs already have width and height parameters
    // We'll update the width parameter if it exists
    if (url.searchParams.has("width")) {
      url.searchParams.set("width", width.toString());
    }
    if (quality) {
      url.searchParams.set("quality", quality.toString());
    }
    return url.toString();
  }

  // For any other URLs, return as is
  console.warn(`Image Loader received an unsupported CDN URL: ${src}`);
  return src;
}
