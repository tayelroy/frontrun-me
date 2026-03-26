import { spawn } from 'node:child_process';
import { env } from '../env';

export interface PicoclawChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PicoclawChatCompletionInput {
  messages: PicoclawChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export function isPicoclawConfigured() {
  return Boolean(env.PICOCLAW_SSH_TARGET || env.PICOCLAW_API_BASE);
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function buildPrompt(messages: PicoclawChatMessage[]) {
  return messages
    .map((message) => {
      if (message.role === 'system') {
        return `[SYSTEM]\n${message.content}`;
      }

      if (message.role === 'assistant') {
        return `[ASSISTANT]\n${message.content}`;
      }

      return `[USER]\n${message.content}`;
    })
    .join('\n\n');
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function callPicoclawViaSsh(input: PicoclawChatCompletionInput) {
  if (!env.PICOCLAW_SSH_TARGET) {
    throw new Error('PICOCLAW_SSH_TARGET is not configured.');
  }

  const args = ['-T', '-o', 'BatchMode=no'];
  if (env.PICOCLAW_SSH_KEY) {
    args.push('-i', env.PICOCLAW_SSH_KEY);
  }
  args.push('-p', String(env.PICOCLAW_SSH_PORT));
  const prompt = buildPrompt(input.messages);
  const remoteCommand = `bash -lc ${shellQuote(`sudo docker exec picoclaw-gateway picoclaw agent -m ${shellQuote(prompt)}`)}`;
  args.push(env.PICOCLAW_SSH_TARGET, remoteCommand);

  return await new Promise<string>((resolve, reject) => {
    const child = spawn('ssh', args, {
      stdio: ['inherit', 'pipe', 'inherit']
    });

    let stdout = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Picoclaw SSH agent exited with code ${code ?? 'unknown'}.`));
        return;
      }

      const content = stdout.trim();
      if (!content) {
        reject(new Error('Picoclaw SSH agent returned an empty response.'));
        return;
      }

      resolve(content);
    });
  });
}

async function callPicoclawViaHttp(input: PicoclawChatCompletionInput) {
  if (!env.PICOCLAW_API_BASE) {
    throw new Error('PICOCLAW_API_BASE is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.PICOCLAW_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeBaseUrl(env.PICOCLAW_API_BASE)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.PICOCLAW_API_KEY ? { Authorization: `Bearer ${env.PICOCLAW_API_KEY}` } : {})
      },
      body: JSON.stringify({
        model: env.PICOCLAW_MODEL,
        messages: input.messages,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 700
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Picoclaw request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Picoclaw returned an empty response.');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callPicoclawChatCompletion(input: PicoclawChatCompletionInput) {
  if (env.PICOCLAW_API_BASE) {
    return callPicoclawViaHttp(input);
  }

  return callPicoclawViaSsh(input);
}
