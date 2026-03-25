'use client';

import { shortenWalletAddress } from '@/lib/onchainos/wallet';
import { useWallet } from './WalletProvider';

type ConnectWalletButtonProps = {
  className?: string;
};

export function ConnectWalletButton({ className }: ConnectWalletButtonProps) {
  const { address, connect, disconnect, errorMessage, status } = useWallet();

  const classes = ['frm-wallet-button', className, `is-${status}`].filter(Boolean).join(' ');

  let label = 'Connect Wallet';
  if (status === 'connecting') {
    label = 'Connecting...';
  } else if (status === 'connected') {
    label = shortenWalletAddress(address);
  } else if (status === 'error') {
    label = 'Retry Wallet';
  }

  async function handleClick() {
    if (status === 'connecting') {
      return;
    }

    if (status === 'connected') {
      await disconnect();
      return;
    }

    await connect();
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={() => {
        void handleClick();
      }}
      disabled={status === 'connecting'}
      aria-busy={status === 'connecting'}
      aria-live="polite"
      title={status === 'error' ? errorMessage ?? 'Wallet connection failed.' : status === 'connected' ? 'Disconnect wallet' : 'Connect wallet'}
    >
      {label}
    </button>
  );
}
