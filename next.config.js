/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@aptos-labs/wallet-adapter-react", "@aptos-labs/wallet-adapter-core"],
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    webpack: (config) => {
        config.resolve.fallback = { "@telegram-apps/bridge": false, got: false, fs: false, path: false };
        return config;
    },
};

module.exports = nextConfig;
