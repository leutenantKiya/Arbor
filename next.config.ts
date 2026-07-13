import type { NextConfig } from "next";

// @particle-network/auth-core bundles an AWS credential-provider chain used
// only by an enterprise Cognito auth path we never exercise (Google login +
// embedded EOA only). That chain pulls in Node built-ins (node:os, node:http,
// ...) which webpack can't resolve for the browser bundle. Stubbing them out
// is safe: the code path is unreachable from our login flow.
const NODE_BUILTIN_STUBS = [
  "os",
  "http",
  "https",
  "net",
  "tls",
  "dns",
  "child_process",
  "fs",
  "crypto",
  "stream",
  "zlib",
  "path",
  "util",
  "querystring",
  "assert",
  "url",
  "events",
  "buffer",
];

const nextConfig: NextConfig = {
  images: {
    // Posters are self-hosted in /public/posters. When media moves to
    // Cloudflare R2 (ARCHITECTURE.md §6), add the R2 hostname here.
    remotePatterns: [],
  },
  // `tsc --noEmit` is run standalone as the real type gate (`npm run
  // typecheck`) and passes clean. The build's own type-check pass has been
  // OOMing on memory-constrained machines once the Particle SDK's module
  // graph is included — skip the redundant pass rather than fight it.
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Webpack's browser target doesn't recognize the `node:` URI scheme —
      // it errors before resolve.fallback ever runs. Strip the prefix first
      // so the bare module name below can be emptied out normally.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          },
        ),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...Object.fromEntries(NODE_BUILTIN_STUBS.map((m) => [m, false])),
      };
    }
    return config;
  },
};

export default nextConfig;
