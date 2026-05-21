import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const zipPath = join(process.cwd(), 'dust-devil-itch.zip');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run npm run build first');
  process.exit(1);
}

if (platform() === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

console.log(`Created ${zipPath}`);
