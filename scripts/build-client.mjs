// Build the browser client bundle following the DSH client preset contract
// (packages/client/tsdown.client.ts): CJS output wrapped in the ModuleLoader
// handoff, platform modules left external (provided by the runtime module table).
import { build } from 'esbuild'

const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const BANNER = [
  'window.__ModuleLoader__.load({ id: "dsh-science", factory: (require) => {',
  'var module = { exports: {} };',
  'var exports = module.exports;',
].join('\n')
const FOOTER = 'return module.exports; } });'

await build({
  entryPoints: ['client-src/index.jsx'],
  outfile: 'client/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  jsx: 'automatic',
  external: PLATFORM_MODULES,
  banner: { js: BANNER },
  footer: { js: FOOTER },
  sourcemap: 'external',
  logLevel: 'info',
})
console.log('[dsh-science] client bundle built -> client/client.js')
