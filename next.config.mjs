/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        // Disable webpack caching to work around file system issues on Windows
        config.cache = false;
        return config;
    }
};

export default nextConfig;
