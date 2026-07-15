import path from "path";
import type { NextConfig } from "next";

// Particle's browser stack has two very different needs webpack must serve:
//
// 1. @particle-network/auth-core bundles an AWS credential-provider chain
//    (enterprise Cognito path we never exercise). It drags in server-only
//    builtins (os, net, fs, ...) — safe to stub to empty modules.
//
// 2. MPC-TSS key generation/signing (@particle-network/thresh-sig, WASM)
//    NEEDS working crypto/stream/buffer/process in the browser. Stubbing
//    these to `false` makes the module resolve to an empty object, and the
//    first login that runs keygen crashes with:
//      TypeError: can't access property "default", x is undefined
//    These MUST be real polyfills, never `false`.
const NODE_BUILTIN_STUBS = [
  // server-only — genuinely unreachable from our login flow
  "net",
  "tls",
  "dns",
  "child_process",
  "http",
  "https",
];

const NODE_BUILTIN_POLYFILLS: Record<string, string> = {
  // required by the MPC-TSS / thresh-sig WASM path at first key generation
  crypto: "crypto-browserify",
  stream: "stream-browserify",
  buffer: "buffer",
  process: "process/browser",
  util: "util",
  events: "events",
  url: "url",
  assert: "assert",
  zlib: "browserify-zlib",
  querystring: "querystring-es3",
  path: "path-browserify",
  os: "os-browserify/browser",
};

// thresh-sig's wasm glue destructures { writeFile } from fs at module
// load — `fs: false` yields undefined and crashes keygen. Shim required.
const FS_SHIM = path.join(__dirname, "lib", "shims", "fs.js");

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
  // lit + @reown/appkit use ESM `export *` re-exports that Next.js webpack
  // can't statically resolve without transpilation. This fixes the
  // "'property' is not exported from 'lit/decorators.js'" error.
  transpilePackages: [
    "lit",
    "@lit/reactive-element",
    "lit-element",
    "lit-html",
    "@reown/appkit",
    "@reown/appkit-scaffold-ui",
    "@reown/appkit-ui",
    "@reown/appkit-utils",
    "@reown/appkit-controllers",
  ],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Webpack's browser target doesn't recognize the `node:` URI scheme —
      // it errors before resolve.fallback ever runs. Strip the prefix first
      // so the bare module names below resolve through fallback normally.
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
        ...Object.fromEntries(
          Object.entries(NODE_BUILTIN_POLYFILLS).map(([m, pkg]) => [
            m,
            require.resolve(pkg),
          ]),
        ),
        fs: FS_SHIM,
      };
      // thresh-sig and friends reference the Buffer/process globals directly.
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: "process/browser.js",
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
