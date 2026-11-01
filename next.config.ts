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
  webpack: (config, {dev, isServer}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }

    // Fix: Disable filesystem cache in development to prevent
    // "Failed to allocate memory" and "rename *.pack.gz_" errors.
    // These occur when webpack cache packs grow too large for available RAM.
    if (dev) {
      config.cache = false;
    }

    // Fix: Reduce memory pressure by limiting parallelism
    if (isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
      };
    }

    return config;
  },
};

export default nextConfig;
