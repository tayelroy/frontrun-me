import { loadEnvFiles } from './load-env';

await loadEnvFiles();

const [{ env }, { callPicoclawChatCompletion, isPicoclawConfigured }] = await Promise.all([
  import('../lib/env'),
  import('../lib/picoclaw/client')
]);

if (!isPicoclawConfigured()) {
  throw new Error('Configure either PICOCLAW_API_BASE or PICOCLAW_SSH_TARGET in .env or .env.local.');
}

const response = await callPicoclawChatCompletion({
  maxTokens: 100,
  temperature: 0,
  messages: [
    {
      role: 'system',
      content: 'Return only the word pong.'
    },
    {
      role: 'user',
      content: 'ping'
    }
  ]
});

console.log(`Picoclaw check succeeded using ${env.PICOCLAW_API_BASE ?? env.PICOCLAW_SSH_TARGET}`);
console.log(response);
