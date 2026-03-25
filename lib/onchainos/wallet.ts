'use client';

import type { OKXUniversalConnectUI } from '@okxconnect/ui';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletSnapshot {
  status: WalletStatus;
  address: string | null;
  chainId: string | null;
  walletName: string | null;
  errorMessage: string | null;
}

const DISCONNECTED_SNAPSHOT: WalletSnapshot = {
  status: 'disconnected',
  address: null,
  chainId: null,
  walletName: null,
  errorMessage: null
};

const REQUIRED_EVM_CHAINS = ['eip155:1'];
const OPTIONAL_EVM_CHAINS = ['eip155:8453', 'eip155:42161', 'eip155:10'];

const EVM_RPC_MAP: Record<string, string> = {
  '1': 'https://ethereum-rpc.publicnode.com',
  '10': 'https://mainnet.optimism.io',
  '42161': 'https://arb1.arbitrum.io/rpc',
  '8453': 'https://mainnet.base.org'
};

type WalletClient = OKXUniversalConnectUI;

let walletClientPromise: Promise<WalletClient> | null = null;

async function createWalletClient() {
  if (typeof window === 'undefined') {
    throw new Error('OnchainOS wallet client must be created in the browser.');
  }

  const { OKXUniversalConnectUI, THEME } = await import('@okxconnect/ui');

  return OKXUniversalConnectUI.init({
    dappMetaData: {
      name: 'FrontRunMe',
      icon: `${window.location.origin}/front-run-me-icon.svg`
    },
    actionsConfiguration: {
      modals: 'all'
    },
    language: 'en_US',
    uiPreferences: {
      theme: THEME.DARK
    }
  });
}

function getWalletClient() {
  if (!walletClientPromise) {
    walletClientPromise = createWalletClient();
  }

  return walletClientPromise;
}

function buildConnectParams() {
  return {
    namespaces: {
      eip155: {
        chains: REQUIRED_EVM_CHAINS,
        defaultChain: '1',
        rpcMap: EVM_RPC_MAP
      }
    },
    optionalNamespaces: {
      eip155: {
        chains: OPTIONAL_EVM_CHAINS,
        rpcMap: EVM_RPC_MAP
      }
    }
  };
}

function toCaipChainId(chainId: string | null) {
  if (!chainId) {
    return null;
  }

  return chainId.startsWith('eip155:') ? chainId : `eip155:${chainId}`;
}

function getConnectedSnapshot(client: OKXUniversalConnectUI): WalletSnapshot {
  if (!client.connected()) {
    return DISCONNECTED_SNAPSHOT;
  }

  const [address] = client.requestAccountsWithNamespace('eip155');
  if (!address) {
    return DISCONNECTED_SNAPSHOT;
  }

  const chainId = toCaipChainId(client.requestDefaultChainWithNamespace('eip155'));

  return {
    status: 'connected',
    address,
    chainId,
    walletName: client.walletName ?? null,
    errorMessage: null
  };
}

export function shortenWalletAddress(address: string | null, visible = 4) {
  if (!address) {
    return '';
  }

  if (address.length <= visible * 2 + 2) {
    return address;
  }

  return `${address.slice(0, visible + 2)}...${address.slice(-visible)}`;
}

export function normalizeWalletError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to connect wallet.';

  if (/reject|denied|declin|cancel|closed|abort/i.test(message)) {
    return 'Wallet connection was cancelled.';
  }

  return message;
}

export function getDisconnectedWalletSnapshot(): WalletSnapshot {
  return DISCONNECTED_SNAPSHOT;
}

export async function readWalletSnapshot() {
  const client = await getWalletClient();
  return getConnectedSnapshot(client);
}

export async function connectWallet() {
  const client = await getWalletClient();
  await client.openModal(buildConnectParams());
  return getConnectedSnapshot(client);
}

export async function disconnectWallet() {
  const client = await getWalletClient();
  await client.disconnect();
  return DISCONNECTED_SNAPSHOT;
}

export async function getWalletClientInstance() {
  return getWalletClient();
}
