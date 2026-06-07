// @module-federation/nextjs-mf v8 requires the locally-installed webpack
// (rather than Next's vendored copy) so the federation runtime can be patched.
process.env.NEXT_PRIVATE_LOCAL_WEBPACK = 'true';

const { NextFederationPlugin } = require('@module-federation/nextjs-mf');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  serverExternalPackages: ['@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/form'],

  webpack(config, { isServer, nextRuntime }) {
    // The Edge runtime (middleware) must not be touched by Module Federation
    // or react externalization — `react` cannot be resolved there as a
    // commonjs external, which crashes middleware with "Native module not found".
    if (nextRuntime === 'edge') {
      return config;
    }

    const pkg = require('./package.json');

    const mantineShared = isServer ? {} : {
      '@mantine/core': { singleton: true, eager: true, requiredVersion: pkg.dependencies['@mantine/core'] },
      '@mantine/hooks': { singleton: true, eager: true, requiredVersion: pkg.dependencies['@mantine/hooks'] },
      '@mantine/form': { singleton: true, eager: true, requiredVersion: pkg.dependencies['@mantine/form'] },
      '@mantine/notifications': { singleton: true, eager: true, requiredVersion: pkg.dependencies['@mantine/notifications'] },
    };

    config.plugins.push(
      new NextFederationPlugin({
        name: 'wishlist',
        filename: 'static/chunks/remoteEntry.js',
        exposes: {
          './pages/index': './pages/index.tsx',
          './pages/profile': './pages/profile.tsx',
        },
        remotes: {
          loctary_auth: `loctary_auth@${
            process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001'
          }/_next/static/chunks/remoteEntry.js`,
        },
        shared: {
          react: { singleton: true, requiredVersion: pkg.dependencies.react },
          'react-dom': { singleton: true, requiredVersion: pkg.dependencies['react-dom'] },
          ...mantineShared,
        },
        extraOptions: {
          exposePages: true,
          enableImageLoaderFix: true,
          enableUrlLoaderFix: true,
        },
      })
    );

    if (isServer) {
      const serverExternals = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'];
      const existing = Array.isArray(config.externals)
        ? config.externals
        : config.externals ? [config.externals] : [];
      config.externals = [
        ...existing,
        ({ request }, callback) => {
          if (serverExternals.includes(request)) return callback(null, `commonjs ${request}`);
          callback();
        },
      ];
    }

    return config;
  },

  // Proxy auth API calls to loctary-auth when both run locally.
  // In production, configure this at the ingress/reverse-proxy level instead.
  async rewrites() {
    const authBase = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/auth/:path*',
        destination: `${authBase}/api/auth/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
