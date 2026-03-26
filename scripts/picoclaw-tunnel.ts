import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const sshTarget = process.env.PICOCLAW_SSH_TARGET?.trim();
const sshPort = process.env.PICOCLAW_SSH_PORT?.trim() || '22';
const sshKeyPathInput = process.env.PICOCLAW_SSH_KEY?.trim();
const localPort = process.env.PICOCLAW_LOCAL_PORT?.trim() || '18800';
const remoteHost = process.env.PICOCLAW_REMOTE_HOST?.trim() || '127.0.0.1';
const remotePort = process.env.PICOCLAW_REMOTE_PORT?.trim() || '18790';

if (!sshTarget) {
  throw new Error(
    'PICOCLAW_SSH_TARGET is required in .env or .env.local, for example: ubuntu@YOUR_VM_PUBLIC_IP'
  );
}

function expandHome(filePath: string) {
  if (filePath.startsWith('~/')) {
    return `${os.homedir()}${filePath.slice(1)}`;
  }

  return filePath;
}

function pickDefaultSshKey() {
  const candidates = ['~/.ssh/id_ed25519', '~/.ssh/id_rsa', '~/.ssh/id_ecdsa', '~/.ssh/id_dsa'];
  for (const candidate of candidates) {
    const expanded = expandHome(candidate);
    if (fs.existsSync(expanded)) {
      return expanded;
    }
  }

  return null;
}

const sshKeyPath = sshKeyPathInput ? expandHome(sshKeyPathInput) : pickDefaultSshKey();

console.log('Opening SSH tunnel:');
console.log(`  local  -> http://127.0.0.1:${localPort}/v1`);
console.log(`  remote -> ${sshTarget}:${remoteHost}:${remotePort}`);
if (sshKeyPath) {
  console.log(`  identity -> ${sshKeyPath}`);
}

const sshArgs = ['-N', '-o', 'ExitOnForwardFailure=yes', '-p', sshPort];
if (sshKeyPath) {
  sshArgs.push('-i', sshKeyPath);
}
sshArgs.push('-L', `${localPort}:${remoteHost}:${remotePort}`, sshTarget);

const child = spawn('ssh', sshArgs, { stdio: 'inherit' });

child.on('error', (error) => {
  console.error('Failed to start SSH tunnel.', error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 0;
});
