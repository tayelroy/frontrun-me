'use client';

import type { ReactNode } from 'react';
import { WalletProvider } from '@/components/wallet/WalletProvider';

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <WalletProvider>{children}</WalletProvider>;
}
