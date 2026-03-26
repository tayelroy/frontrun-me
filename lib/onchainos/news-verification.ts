import { env } from '../env';

export type TelegramVerificationStatus = 'unverified' | 'partial' | 'verified';

export interface TelegramVerificationEvidence {
  provider: 'okx_onchain_os';
  status: TelegramVerificationStatus;
  scoreBoost: number;
  summary: string;
  verifiedAt: string;
  twitterMatches: string[];
  transactionHashes: string[];
  notes: string[];
  rawProviderPayload: Record<string, unknown> | null;
}

interface VerifyInput {
  messageText: string | null;
  normalizedText: string;
  extractedLinks: string[];
}

const TX_HASH_REGEX = /\b0x[a-fA-F0-9]{64}\b/g;
const TWITTER_STATUS_REGEX = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/\s]+\/status\/\d+/i;

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function getTwitterLinksFromText(value: string) {
  const matches = value.match(/https?:\/\/[^\s)]+/gi) ?? [];
  return matches.filter((link) => TWITTER_STATUS_REGEX.test(link));
}

function getTwitterLinks(links: string[], messageText: string | null) {
  const fromLinks = links.filter((link) => TWITTER_STATUS_REGEX.test(link));
  const fromText = getTwitterLinksFromText(messageText ?? '');
  return unique([...fromLinks, ...fromText]);
}

function getTransactionHashes(input: { messageText: string | null; normalizedText: string; links: string[] }) {
  const textMatches = (input.messageText ?? '').match(TX_HASH_REGEX) ?? [];
  const normalizedMatches = input.normalizedText.match(TX_HASH_REGEX) ?? [];
  const linkMatches = input.links.flatMap((link) => link.match(TX_HASH_REGEX) ?? []);

  return unique([...textMatches, ...normalizedMatches, ...linkMatches].map((hash) => hash.toLowerCase()));
}

function calculateBaseScoreBoost(twitterMatches: string[], transactionHashes: string[]) {
  let scoreBoost = 0;

  if (twitterMatches.length > 0) {
    scoreBoost += Math.min(twitterMatches.length * 6, 12);
  }

  if (transactionHashes.length > 0) {
    scoreBoost += Math.min(transactionHashes.length * 8, 16);
  }

  if (twitterMatches.length > 0 && transactionHashes.length > 0) {
    scoreBoost += 6;
  }

  return Math.min(scoreBoost, 24);
}

function buildSummary(status: TelegramVerificationStatus, twitterMatches: string[], transactionHashes: string[]) {
  if (status === 'verified') {
    return `Verified via Twitter (${twitterMatches.length}) and onchain tx (${transactionHashes.length}).`;
  }

  if (status === 'partial' && transactionHashes.length > 0) {
    return `Partially verified via onchain tx (${transactionHashes.length}).`;
  }

  if (status === 'partial' && twitterMatches.length > 0) {
    return `Partially verified via Twitter (${twitterMatches.length}).`;
  }

  return 'No Twitter status links or onchain transactions detected.';
}

function deriveStatus(twitterMatches: string[], transactionHashes: string[]): TelegramVerificationStatus {
  if (twitterMatches.length > 0 && transactionHashes.length > 0) {
    return 'verified';
  }

  if (twitterMatches.length > 0 || transactionHashes.length > 0) {
    return 'partial';
  }

  return 'unverified';
}

async function verifyWithOnchainOsApi(input: {
  twitterMatches: string[];
  transactionHashes: string[];
  messageText: string | null;
  normalizedText: string;
}) {
  if (!env.ONCHAINOS_VERIFY_API_BASE) {
    return null;
  }

  const base = env.ONCHAINOS_VERIFY_API_BASE.replace(/\/+$/, '');
  const endpoint = `${base}${env.ONCHAINOS_VERIFY_API_PATH}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.ONCHAINOS_API_KEY ? { Authorization: `Bearer ${env.ONCHAINOS_API_KEY}` } : {})
    },
    body: JSON.stringify({
      twitterLinks: input.twitterMatches,
      transactionHashes: input.transactionHashes,
      messageText: input.messageText,
      normalizedText: input.normalizedText
    })
  });

  if (!response.ok) {
    throw new Error(`OnchainOS verification request failed (${response.status}).`);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return payload;
}

function parseProviderScoreBoost(payload: Record<string, unknown> | null) {
  const numericCandidates = [
    payload?.scoreBoost,
    payload?.verificationBoost,
    payload?.confidenceBoost,
    payload?.score
  ];

  for (const candidate of numericCandidates) {
    const asNumber = Number(candidate);
    if (Number.isFinite(asNumber)) {
      return Math.max(0, Math.min(Math.round(asNumber), 24));
    }
  }

  return null;
}

function parseProviderStatus(payload: Record<string, unknown> | null, fallback: TelegramVerificationStatus) {
  const raw = String(payload?.status ?? payload?.verificationStatus ?? '').toLowerCase();
  if (raw === 'verified' || raw === 'partial' || raw === 'unverified') {
    return raw;
  }

  return fallback;
}

function parseProviderNotes(payload: Record<string, unknown> | null) {
  const value = payload?.notes;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function verifyNewsSignalWithOnchainOs(input: VerifyInput): Promise<TelegramVerificationEvidence> {
  const twitterMatches = getTwitterLinks(input.extractedLinks, input.messageText);
  const transactionHashes = getTransactionHashes({
    messageText: input.messageText,
    normalizedText: input.normalizedText,
    links: input.extractedLinks
  });

  const localStatus = deriveStatus(twitterMatches, transactionHashes);
  const localScoreBoost = calculateBaseScoreBoost(twitterMatches, transactionHashes);
  let providerPayload: Record<string, unknown> | null = null;
  let notes: string[] = [];

  try {
    providerPayload = await verifyWithOnchainOsApi({
      twitterMatches,
      transactionHashes,
      messageText: input.messageText,
      normalizedText: input.normalizedText
    });

    notes = parseProviderNotes(providerPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OnchainOS verification fallback used.';
    notes = [message];
  }

  const status = parseProviderStatus(providerPayload, localStatus);
  const providerScore = parseProviderScoreBoost(providerPayload);
  const scoreBoost = providerScore ?? localScoreBoost;

  return {
    provider: 'okx_onchain_os',
    status,
    scoreBoost,
    summary: buildSummary(status, twitterMatches, transactionHashes),
    verifiedAt: new Date().toISOString(),
    twitterMatches,
    transactionHashes,
    notes,
    rawProviderPayload: providerPayload
  };
}
