'use client';

import { useState } from 'react';
import type { AccessSnapshot } from '@/lib/types';

type AccessCodePanelProps = {
  access: AccessSnapshot | null;
  className?: string;
  isWalletConnected: boolean;
  paymentStatus: 'idle' | 'paying' | 'verification_pending' | 'payment_success' | 'payment_failure';
};

export function AccessCodePanel({ access, className, isWalletConnected, paymentStatus }: AccessCodePanelProps) {
  const [copied, setCopied] = useState(false);

  if (!isWalletConnected) {
    return (
      <div className={['frm-access-panel', className].filter(Boolean).join(' ')}>
        <strong>Connect your wallet first.</strong>
        <p>We only reveal the Telegram access code after your wallet is connected and backend access is confirmed.</p>
      </div>
    );
  }

  if (paymentStatus !== 'payment_success' || !access?.accessCode) {
    return (
      <div className={['frm-access-panel', className].filter(Boolean).join(' ')}>
        <strong>Telegram bot access unlocks after payment confirmation.</strong>
        <p>Once access is verified on the backend, your one-time code will appear here with the bot instructions.</p>
      </div>
    );
  }

  const accessCode = access.accessCode;
  const linkedLine = access.linkedTelegramUserId
    ? `Already linked to Telegram user ${access.linkedTelegramUserId}.`
    : 'Send /start with this code to the bot to link your Telegram account.';

  return (
    <div className={['frm-access-panel', 'is-unlocked', className].filter(Boolean).join(' ')}>
      <div className="frm-access-panel-head">
        <strong>Telegram Bot Access Code</strong>
        <span>{access.linkedTelegramUserId ? 'Linked' : 'Ready to claim'}</span>
      </div>
      <div className="frm-access-code-row">
        <code>{accessCode}</code>
        <button
          type="button"
          className="frm-access-copy"
          onClick={() => {
            void navigator.clipboard.writeText(accessCode).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="frm-access-help">
        Open Telegram and send <code>/start {accessCode}</code> to your FrontRunMe bot. {linkedLine}
      </p>
    </div>
  );
}
