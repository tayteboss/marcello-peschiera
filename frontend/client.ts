import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

type SanityClientLike = {
  fetch<T = unknown>(query: string, params?: Record<string, unknown>): Promise<T>;
};

/**
 * In non-configured environments (no Sanity env vars), fall back to a no-op client
 * so that `next build` can still succeed. Pages that rely on Sanity will simply
 * receive empty results instead of throwing during build.
 */
let client: SanityClientLike;

if (!projectId || !dataset) {
  // eslint-disable-next-line no-console
  console.warn(
    "Sanity env vars (NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET) are not set. Using a mock client that returns empty results.",
  );

  client = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async fetch<T = unknown>(_query: string, _params?: Record<string, unknown>): Promise<T> {
      return [] as unknown as T;
    },
  };
} else {
  client = createClient({
    projectId,
    dataset,
    useCdn: false, // `false` if you want to ensure fresh data
    apiVersion: "2024-09-24", // use a UTC date string
  });
}

export default client;
