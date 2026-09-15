/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack(config) {
    // Suppress PackFileCacheStrategy "Serializing big strings" noise.
    // These are dev-cache-only warnings; they have no effect on production builds.
    config.infrastructureLogging = { level: "error" }
    return config
  },
}

export default nextConfig
