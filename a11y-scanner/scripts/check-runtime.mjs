import { createRequire } from 'node:module';

const require = createRequire(process.argv[2]);
for (const dependency of ['playwright', 'axe-core']) {
  require.resolve(dependency);
}
