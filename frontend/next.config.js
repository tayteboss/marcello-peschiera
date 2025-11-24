// Use require (CommonJS) to import the plugin
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true', // Only enable when ANALYZE env var is 'true'
});

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'image.mux.com',
        pathname: '/**',
      },
    ],
    loader: 'custom',
    loaderFile: './lib/sanityImageLoader.ts',
  },
  compiler: {
    styledComponents: {
      ssr: true,
      displayName: true,
    },
  },
};

// Use module.exports (CommonJS) to export the wrapped config
module.exports = withBundleAnalyzer(nextConfig);