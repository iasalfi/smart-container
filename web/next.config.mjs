/** Static export: the whole demo is client-side on synthetic data, so it hosts for free on Vercel. */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
