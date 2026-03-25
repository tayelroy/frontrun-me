import { canTelegramUserAccessBot, redeemTelegramAccessCode } from '../access';
import { listPublishedInsights } from '../repository';

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
    };
  };
};

export function extractStartCode(text: string) {
  const match = text.trim().match(/^\/start(?:@\w+)?\s+([A-Za-z0-9-]+)/i);
  return match?.[1] ?? null;
}

export async function buildTelegramBotReply(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.from?.id || !message.chat?.id) {
    return null;
  }

  const telegramUserId = String(message.from.id);
  const telegramHandle = message.from.username ? `@${message.from.username}` : null;
  const text = message.text?.trim() ?? '';
  const startCode = extractStartCode(text);

  if (startCode) {
    const claimed = await redeemTelegramAccessCode({
      accessCode: startCode,
      telegramUserId,
      telegramHandle
    });

    if (!claimed.ok) {
      return {
        chatId: message.chat.id,
        text: 'That access code is invalid or already claimed. Pay on FrontRunMe, then use /start YOUR_CODE here.'
      };
    }

    return {
      chatId: message.chat.id,
      text: 'Access confirmed. You are verified for FrontRunMe bot updates. Ask: what’s important today?'
    };
  }

  const verified = await canTelegramUserAccessBot(telegramUserId);
  if (!verified) {
    return {
      chatId: message.chat.id,
      text: 'You are not verified yet. Complete the x402 checkout, then send /start YOUR_ACCESS_CODE to unlock the bot.'
    };
  }

  if (/what('?| i)s important today\??/i.test(text)) {
    const insights = await listPublishedInsights(3);
    const body =
      insights.length > 0
        ? insights
            .map((item, index) => `${index + 1}. ${item.title}\n${item.summary}\nWhy it matters: ${item.whyItMatters}`)
            .join('\n\n')
        : 'No published insights yet. The pipeline is live, but there are no promoted signals to send right now.';

    return {
      chatId: message.chat.id,
      text: `Today’s important signals:\n\n${body}`
    };
  }

  return {
    chatId: message.chat.id,
    text: 'You are verified. Ask "what’s important today?" to get the latest published FrontRunMe signals.'
  };
}
