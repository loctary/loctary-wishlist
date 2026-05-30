const { NextFederationPlugin } = require('@module-federation/nextjs-mf');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  serverExternalPackages: ['@mantine/core', '@mantine/hooks', '@mantine/notifications'],

  async rewrites() {
    const authBase = process.env.NEXT_PUBLIC_AUTH_REMOTE_URL ?? 'http://localhost:3001';
    return [{ source: '/api/auth/:path*', destination: `${authBase}/api/auth/:path*` }];
  },

  webpack(config, { isServer }) {
    const pkg = require('./package.json');

    const mantineShared = isServer ? {} : {
      '@mantine/core': { singleton: true, eager: true, requiredVersion: pkg.dependencies['@mantine/core'] },
      '@mantine/hooks': { singleton: true, eager: true, requiredVersion: pkg.dependencies['@mantine/hooks'] },
    };

    config.plugins.push(
      new NextFederationPlugin({
        name: 'wishlist',
        filename: 'static/chunks/remoteEntry.js',
        remotes: {
          loctary_auth: `loctary_auth@${
            process.env.NEXT_PUBLIC_AUTH_REMOTE_URL ?? 'http://localhost:3001'
          }/_next/static/chunks/remoteEntry.js`,
        },
        exposes: {
          './ThemedMantineProvider': './components/RemoteMantineProvider/index',
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
};

module.exports = nextConfig;
