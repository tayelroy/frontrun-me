import fs from 'node:fs/promises';
import path from 'node:path';

function parseEnv(contents: string) {
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export async function loadEnvFiles(cwd = process.cwd()) {
  for (const fileName of ['.env.local', '.env']) {
    const fullPath = path.resolve(cwd, fileName);

    try {
      const contents = await fs.readFile(fullPath, 'utf8');
      parseEnv(contents);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }

      throw error;
    }
  }
}
