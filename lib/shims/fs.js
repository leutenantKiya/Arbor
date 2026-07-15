// Browser no-op shim for Node's `fs`.
//
// Particle's thresh-sig WASM glue destructures { writeFile } from `fs` at
// module top level (Node-only code path, never called in the browser).
// Webpack's `fallback: { fs: false }` yields `undefined`, which crashes at
// login with: "Cannot destructure property 'writeFile' of ... undefined".
// The shim exists so the destructure succeeds; nothing here ever runs.
const noop = () => {};
const asyncNoop = async () => {};

module.exports = {
  writeFile: noop,
  writeFileSync: noop,
  readFile: noop,
  readFileSync: noop,
  existsSync: () => false,
  mkdirSync: noop,
  readdirSync: () => [],
  statSync: noop,
  createReadStream: noop,
  createWriteStream: noop,
  promises: {
    writeFile: asyncNoop,
    readFile: asyncNoop,
    mkdir: asyncNoop,
    stat: asyncNoop,
  },
};
