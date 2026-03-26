import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ env }] = await Promise.all([import('../lib/env')]);

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

const chatCompletionSchema = z.object({
  model: z.string().optional(),
  messages: z.array(messageSchema).min(1),
  temperature: z.number().optional(),
  max_tokens: z.number().optional()
});

function buildPrompt(messages: Array<z.infer<typeof messageSchema>>) {
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

function writeJson(
  response: import('node:http').ServerResponse<import('node:http').IncomingMessage>,
  statusCode: number,
  payload: unknown
) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as unknown;
}

function isAuthorized(request: import('node:http').IncomingMessage) {
  if (!env.PICOCLAW_API_KEY) {
    return true;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  return authHeader.slice('Bearer '.length) === env.PICOCLAW_API_KEY;
}

async function runPicoclawAgent(prompt: string) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(
      'sudo',
      ['docker', 'exec', env.PICOCLAW_GATEWAY_CONTAINER, 'picoclaw', 'agent', '-m', prompt],
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Picoclaw agent exited with code ${code ?? 'unknown'}.`));
        return;
      }

      const content = stdout.trim();
      if (!content) {
        reject(new Error('Picoclaw agent returned an empty response.'));
        return;
      }

      resolve(content);
    });
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && request.url === '/v1/models') {
      writeJson(response, 200, {
        object: 'list',
        data: [
          {
            id: env.PICOCLAW_MODEL,
            object: 'model',
            owned_by: 'picoclaw'
          }
        ]
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      if (!isAuthorized(request)) {
        writeJson(response, 401, { error: 'Unauthorized' });
        return;
      }

      const payload = chatCompletionSchema.parse(await readJsonBody(request));
      const prompt = buildPrompt(payload.messages);
      const content = await runPicoclawAgent(prompt);

      writeJson(response, 200, {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: payload.model ?? env.PICOCLAW_MODEL,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content
            },
            finish_reason: 'stop'
          }
        ]
      });
      return;
    }

    writeJson(response, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeJson(response, 500, { error: message });
  }
});

server.listen(env.PICOCLAW_HTTP_PORT, env.PICOCLAW_HTTP_HOST, () => {
  console.log(
    `Picoclaw HTTP bridge listening on http://${env.PICOCLAW_HTTP_HOST}:${env.PICOCLAW_HTTP_PORT}/v1/chat/completions`
  );
  console.log(`Container target: ${env.PICOCLAW_GATEWAY_CONTAINER}`);
  console.log(env.PICOCLAW_API_KEY ? 'Bearer auth: enabled' : 'Bearer auth: disabled');
});
