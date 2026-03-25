'use client';

import { getWalletClientInstance } from '@/lib/onchainos/wallet';
import type { AccessSnapshot, AccessStatusResponse } from '@/lib/types';

export type CheckoutStatus = 'idle' | 'paying' | 'verification_pending' | 'payment_success' | 'payment_failure';

export interface PreparedX402Checkout {
  reference: string;
  walletAddress: string;
  chain: string;
  chainId: string;
  amount: string;
  currency: string;
  recipientAddress: string;
  assetAddress: string | null;
  assetDecimals: number;
  resource: string;
  description: string;
}

export interface FinalizeCheckoutInput {
  walletAddress: string;
  chain: string;
  amount: string;
  currency: string;
  reference: string;
  transactionHash: string;
}

function extractErrorDetails(error: unknown): string[] {
  if (!error) {
    return [];
  }

  if (typeof error === 'string') {
    return [error];
  }

  if (error instanceof Error) {
    return [error.message];
  }

  if (typeof error === 'object') {
    const candidates = [
      'message',
      'msg',
      'name',
      'code',
      'reason',
      'detail',
      'description'
    ] as const;

    const values = candidates
      .map((key) => {
        const value = (error as Record<string, unknown>)[key];
        return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
      })
      .filter((value): value is string => Boolean(value));

    for (const nestedKey of ['error', 'data', 'cause'] as const) {
      const nestedValue = (error as Record<string, unknown>)[nestedKey];
      values.push(...extractErrorDetails(nestedValue));
    }

    return [...new Set(values)];
  }

  return [];
}

function stripHexPrefix(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function padHex(value: string, size = 64) {
  return stripHexPrefix(value).padStart(size, '0');
}

function toHexQuantity(value: bigint) {
  return `0x${value.toString(16)}`;
}

function decimalToBaseUnits(amount: string, decimals: number) {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Invalid checkout amount.');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const paddedFraction = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`);
}

function encodeErc20Transfer(recipient: string, amountBaseUnits: bigint) {
  const selector = 'a9059cbb';
  const addressWord = padHex(recipient.toLowerCase().replace(/^0x/, ''));
  const amountWord = padHex(amountBaseUnits.toString(16));
  return `0x${selector}${addressWord}${amountWord}`;
}

function chainIdToHex(chainId: string) {
  return `0x${BigInt(chainId).toString(16)}`;
}

export function normalizeCheckoutError(error: unknown) {
  const details = extractErrorDetails(error);
  const message = details[0] ?? 'Checkout failed.';

  if (/connect wallet/i.test(message)) {
    return 'Connect your wallet before starting checkout.';
  }

  if (/reject|denied|declin|cancel|closed|abort/i.test(message)) {
    return 'Payment was cancelled in the wallet.';
  }

  if (/transaction-error/i.test(message)) {
    return 'The wallet failed to submit the transaction. Check the network, token balance, and wallet support for this testnet.';
  }

  if (/insufficient/i.test(message)) {
    return 'The connected wallet does not have enough balance to submit this transaction.';
  }

  if (details.length > 1) {
    return `${message} (${details.slice(1).join(' | ')})`;
  }

  return message;
}

export async function prepareX402Checkout(walletAddress: string) {
  const response = await fetch('/api/payments/x402/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ walletAddress })
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; checkout?: PreparedX402Checkout; message?: string }
    | null;

  if (!response.ok || !payload?.checkout) {
    throw new Error(payload?.message ?? 'Unable to prepare x402 checkout.');
  }

  return payload.checkout;
}

export async function sendX402Payment(checkout: PreparedX402Checkout) {
  const client = await getWalletClientInstance();

  if (!client.connected()) {
    throw new Error('Connect wallet before starting checkout.');
  }

  const caipChain = `eip155:${checkout.chainId}`;
  const amountBaseUnits = decimalToBaseUnits(checkout.amount, checkout.assetDecimals);

  try {
    await client.request(
      {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdToHex(checkout.chainId) }]
      },
      caipChain
    );
  } catch {
    // If the wallet rejects or does not support switching here, the transaction request below will still surface a clear error.
  }

  if (checkout.assetAddress) {
    return client.request<string>(
      {
        method: 'eth_sendTransaction',
        params: [
          {
            from: checkout.walletAddress,
            to: checkout.assetAddress,
            value: '0x0',
            data: encodeErc20Transfer(checkout.recipientAddress, amountBaseUnits)
          }
        ]
      },
      caipChain
    );
  }

  return client.request<string>(
    {
      method: 'eth_sendTransaction',
      params: [
        {
          from: checkout.walletAddress,
          to: checkout.recipientAddress,
          value: toHexQuantity(amountBaseUnits)
        }
      ]
    },
    caipChain
  );
}

export async function finalizeX402Checkout(input: FinalizeCheckoutInput) {
  const response = await fetch('/api/webhooks/x402', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message ?? 'The backend could not verify the completed payment.');
  }

  return payload;
}

export async function fetchAccessSnapshot(walletAddress: string): Promise<AccessSnapshot> {
  const response = await fetch(`/api/access/${walletAddress}`, {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; access?: AccessSnapshot } | null;

  if (!response.ok || !payload?.ok || !payload.access) {
    throw new Error('Unable to refresh access details from the backend.');
  }

  return payload.access;
}

export async function fetchAccessStatus(walletAddress: string): Promise<AccessStatusResponse> {
  const response = await fetch(`/api/access/status?walletAddress=${encodeURIComponent(walletAddress)}`, {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; hasAccess?: boolean; message?: string } & Partial<AccessStatusResponse>)
    | null;

  if (!response.ok || !payload?.ok || typeof payload.hasAccess !== 'boolean') {
    throw new Error(payload?.message ?? 'Unable to refresh access status from the backend.');
  }

  return { hasAccess: payload.hasAccess };
}

export async function waitForAccessGrant(walletAddress: string, options?: { attempts?: number; delayMs?: number }) {
  const attempts = options?.attempts ?? 8;
  const delayMs = options?.delayMs ?? 1250;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const next = await fetchAccessStatus(walletAddress);
    if (next.hasAccess) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}
