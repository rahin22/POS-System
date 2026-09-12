import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-12">
      <div className="animate-scale-in card w-full max-w-[820px] p-14 text-center">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle className="h-12 w-12 text-danger" aria-hidden="true" />
        </span>

        <h2 className="mt-8 text-kiosk-xl font-extrabold text-ink-900">{title}</h2>
        <p className="mt-4 text-kiosk-base text-ink-700">{message}</p>

        <div className="mt-10 space-y-5">
          {/* Keeping the order is the safe default, so it gets the primary weight */}
          <button type="button" onClick={onCancel} className="btn-primary w-full text-kiosk-base">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-secondary w-full border-danger/40 text-kiosk-base text-danger"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
