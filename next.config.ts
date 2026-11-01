import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }

    // Fix: Use in-memory cache in dev instead of filesystem cache.
    //
    // Setting cache:false broke Next.js App Router's clientReferenceManifest
    // (used for React Server Components), causing:
    //   "Invariant: Expected clientReferenceManifest to be defined"
    //
    // Using type:'memory' avoids both problems:
    //   ✓ No more "Failed to allocate memory" (no disk pack writes)
    //   ✓ No more "rename *.pack.gz_" file-lock errors
    //   ✓ clientReferenceManifest is correctly tracked in memory
    //   ✓ Fast incremental rebuilds are preserved
    if (dev) {
      config.cache = {
        type: 'memory',
      };
    }

    return config;
  },
};

export default nextConfig;
