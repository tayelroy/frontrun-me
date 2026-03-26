const COINGECKO_TOKEN_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  XRP: 'ripple',
  BNB: 'binancecoin',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  TON: 'the-open-network',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  APT: 'aptos',
  OKB: 'okb'
};

const TOKEN_NAME_ALIASES: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  ripple: 'XRP',
  bnb: 'BNB',
  cardano: 'ADA',
  dogecoin: 'DOGE',
  avalanche: 'AVAX',
  chainlink: 'LINK',
  toncoin: 'TON',
  arbitrum: 'ARB',
  optimism: 'OP',
  sui: 'SUI',
  aptos: 'APT',
  okb: 'OKB'
};

const TOKEN_STOP_WORDS = new Set(['ETF', 'SEC', 'FED', 'USD', 'USDT', 'USDC', 'TVL', 'DAO', 'API']);

export interface TokenPriceLink {
  symbol: string;
  url: string;
}

function fromDollarTicker(text: string) {
  const match = text.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/);
  if (!match?.[1]) {
    return null;
  }

  return match[1].toUpperCase();
}

function fromUppercaseTicker(text: string) {
  const matches = text.match(/\b[A-Z]{2,6}\b/g) ?? [];
  for (const candidate of matches) {
    if (TOKEN_STOP_WORDS.has(candidate)) {
      continue;
    }

    if (COINGECKO_TOKEN_IDS[candidate]) {
      return candidate;
    }
  }

  return null;
}

function fromTokenName(text: string) {
  const normalized = text.toLowerCase();

  for (const [name, symbol] of Object.entries(TOKEN_NAME_ALIASES)) {
    if (normalized.includes(name)) {
      return symbol;
    }
  }

  return null;
}

export function detectFeaturedTokenSymbol(text: string | null | undefined) {
  const value = text?.trim() ?? '';
  if (!value) {
    return null;
  }

  return fromDollarTicker(value) ?? fromUppercaseTicker(value) ?? fromTokenName(value);
}

export function buildTokenPriceLink(symbol: string): TokenPriceLink {
  const normalizedSymbol = symbol.toUpperCase();
  const geckoId = COINGECKO_TOKEN_IDS[normalizedSymbol];

  if (geckoId) {
    return {
      symbol: normalizedSymbol,
      url: `https://www.coingecko.com/en/coins/${geckoId}`
    };
  }

  return {
    symbol: normalizedSymbol,
    url: `https://dexscreener.com/search?q=${encodeURIComponent(normalizedSymbol)}`
  };
}
