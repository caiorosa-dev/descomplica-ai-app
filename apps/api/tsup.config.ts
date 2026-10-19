import { resolve } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/cli/*.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  noExternal: [/^@app\//],
  external: [/^@prisma\//],
  esbuildPlugins: [
    {
      // Resolve workspace packages to their sources directly, so a stray Yarn PnP manifest
      // in a parent folder (esbuild honours any .pnp.cjs it finds) cannot block them.
      name: 'workspace-sources',
      setup(build) {
        build.onResolve({ filter: /^@app\/(shared|db|pipeline)$/ }, (args) => ({
          path: resolve(import.meta.dirname, `../../packages/${args.path.slice('@app/'.length)}/src/index.ts`),
        }));
      },
    },
  ],
});
