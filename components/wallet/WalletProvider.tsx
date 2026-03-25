'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  connectWallet,
  disconnectWallet,
  getDisconnectedWalletSnapshot,
  getWalletClientInstance,
  normalizeWalletError,
  readWalletSnapshot,
  type WalletSnapshot
} from '@/lib/onchainos/wallet';

type WalletContextValue = WalletSnapshot & {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [wallet, setWallet] = useState<WalletSnapshot>(getDisconnectedWalletSnapshot);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    async function hydrateWallet() {
      try {
        const client = await getWalletClientInstance();
        if (!mounted) return;

        const sync = async () => {
          const next = await readWalletSnapshot();
          if (mounted) {
            setWallet(next);
          }
        };

        await sync();

        const handleSessionChange = () => {
          void sync();
        };

        const handleSessionDelete = () => {
          if (mounted) {
            setWallet(getDisconnectedWalletSnapshot());
          }
        };

        client.on('session_update', handleSessionChange);
        client.on('accountChanged', handleSessionChange);
        client.on('session_delete', handleSessionDelete);

        cleanup = () => {
          client.off('session_update', handleSessionChange);
          client.off('accountChanged', handleSessionChange);
          client.off('session_delete', handleSessionDelete);
        };
      } catch (error) {
        if (!mounted) return;

        setWallet({
          ...getDisconnectedWalletSnapshot(),
          status: 'error',
          errorMessage: normalizeWalletError(error)
        });
      }
    }

    void hydrateWallet();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  async function handleConnect() {
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    setWallet((current) => ({
      ...current,
      status: 'connecting',
      errorMessage: null
    }));

    try {
      const next = await connectWallet();
      setWallet(next);
    } catch (error) {
      setWallet({
        ...getDisconnectedWalletSnapshot(),
        status: 'error',
        errorMessage: normalizeWalletError(error)
      });
    } finally {
      isConnectingRef.current = false;
    }
  }

  async function handleDisconnect() {
    try {
      const next = await disconnectWallet();
      setWallet(next);
    } catch (error) {
      setWallet((current) => ({
        ...current,
        status: 'error',
        errorMessage: normalizeWalletError(error)
      }));
    }
  }

  return (
    <WalletContext.Provider
      value={{
        ...wallet,
        connect: handleConnect,
        disconnect: handleDisconnect
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider.');
  }

  return context;
}
