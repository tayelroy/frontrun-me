'use client';

import type { AccessSnapshot } from '@/lib/types';

type UnlockButtonProps = {
  className?: string;
  access: AccessSnapshot | null;
  canStartCheckout: boolean;
  error: string | null;
  isWalletConnected: boolean;
  paymentStatus: 'idle' | 'paying' | 'verification_pending' | 'payment_success' | 'payment_failure';
  onClick: () => void;
};

export function UnlockButton({
  access,
  canStartCheckout,
  className,
  error,
  isWalletConnected,
  onClick,
  paymentStatus
}: UnlockButtonProps) {
  const classes = ['frm-button', 'frm-button-solid', 'frm-unlock-button', className, `is-${paymentStatus}`]
    .filter(Boolean)
    .join(' ');

  let label = 'Unlock via x402';
  if (!isWalletConnected) {
    label = 'Connect Wallet to Unlock';
  } else if (paymentStatus === 'paying') {
    label = 'Confirm in Wallet...';
  } else if (paymentStatus === 'verification_pending') {
    label = 'Verifying Access...';
  } else if (paymentStatus === 'payment_success') {
    label = access?.paymentReference ? 'Access Confirmed' : 'Unlocked';
  } else if (paymentStatus === 'payment_failure') {
    label = 'Retry Unlock';
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={!canStartCheckout}
      aria-busy={paymentStatus === 'paying' || paymentStatus === 'verification_pending'}
      aria-live="polite"
      title={error ?? undefined}
    >
      {label}
    </button>
  );
}
