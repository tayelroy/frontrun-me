'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchAccessSnapshot,
  fetchAccessStatus,
  finalizeX402Checkout,
  normalizeCheckoutError,
  prepareX402Checkout,
  sendX402Payment,
  waitForAccessGrant,
  type CheckoutStatus
} from '@/lib/onchainos/payments';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { AccessSnapshot } from '@/lib/types';

export function useX402Checkout() {
  const { address, status: walletStatus } = useWallet();
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [access, setAccess] = useState<AccessSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusyRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function hydrateAccess() {
      if (!address || walletStatus !== 'connected') {
        if (mounted) {
          setAccess(null);
          setStatus('idle');
        }
        return;
      }

      try {
        const next = await fetchAccessStatus(address);
        if (!mounted) return;

        if (next.hasAccess) {
          const snapshot = await fetchAccessSnapshot(address);
          if (!mounted) return;
          setAccess(snapshot);
          setStatus('payment_success');
        } else {
          setAccess(null);
          setStatus('idle');
        }
      } catch {
        if (!mounted) return;
        setAccess(null);
      }
    }

    void hydrateAccess();

    return () => {
      mounted = false;
    };
  }, [address, walletStatus]);

  const canStartCheckout = walletStatus === 'connected' && !access && status !== 'paying' && status !== 'verification_pending';

  async function startCheckout() {
    if (isBusyRef.current) {
      return;
    }

    if (!address || walletStatus !== 'connected') {
      setStatus('payment_failure');
      setErrorMessage('Connect your wallet before starting checkout.');
      return;
    }

    isBusyRef.current = true;
    setErrorMessage(null);
    setStatus('paying');

    try {
      const checkout = await prepareX402Checkout(address);
      const transactionHash = await sendX402Payment(checkout);

      setStatus('verification_pending');

      await finalizeX402Checkout({
        walletAddress: address,
        chain: checkout.chain,
        amount: checkout.amount,
        currency: checkout.currency,
        reference: checkout.reference,
        transactionHash
      });

      const accessGranted = await waitForAccessGrant(address);
      if (!accessGranted) {
        throw new Error('Payment submitted, but backend access confirmation is still pending.');
      }

      const snapshot = await fetchAccessSnapshot(address);
      setAccess(snapshot);
      setStatus('payment_success');
    } catch (error) {
      console.error('x402 checkout failed', error);
      setStatus('payment_failure');
      setErrorMessage(normalizeCheckoutError(error));
    } finally {
      isBusyRef.current = false;
    }
  }

  return {
    access,
    canStartCheckout,
    error: errorMessage,
    isPaying: status === 'paying' || status === 'verification_pending',
    isWalletConnected: walletStatus === 'connected',
    paymentStatus: status,
    startCheckout
  };
}
