import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const runtimeRoot = '.next/standalone/apps/webapp';

for (const directory of ['.next/static', 'public']) {
  const source = directory;
  const target = `${runtimeRoot}/${directory}`;
  if (existsSync(source)) {
    mkdirSync(target, { recursive: true });
    cpSync(source, target, { recursive: true });
  }
}

const child = spawn(process.execPath, [`${runtimeRoot}/server.js`], {
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
