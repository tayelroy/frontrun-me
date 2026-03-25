'use client';

import { AccessCodePanel } from '@/components/payments/AccessCodePanel';
import { UnlockButton } from '@/components/payments/UnlockButton';
import { useX402Checkout } from '@/hooks/useX402Checkout';

type CheckoutPanelProps = {
  className?: string;
};

export function CheckoutPanel({ className }: CheckoutPanelProps) {
  const checkout = useX402Checkout();

  return (
    <div className={['frm-checkout-panel', className].filter(Boolean).join(' ')}>
      <UnlockButton
        access={checkout.access}
        canStartCheckout={checkout.canStartCheckout}
        error={checkout.error}
        isWalletConnected={checkout.isWalletConnected}
        paymentStatus={checkout.paymentStatus}
        onClick={() => {
          void checkout.startCheckout();
        }}
      />
      {checkout.error ? <p className="frm-checkout-error">{checkout.error}</p> : null}
      <AccessCodePanel
        access={checkout.access}
        isWalletConnected={checkout.isWalletConnected}
        paymentStatus={checkout.paymentStatus}
      />
    </div>
  );
}
