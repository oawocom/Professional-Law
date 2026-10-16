'use client';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  autoClose?: boolean;
  autoCloseDuration?: number;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  description,
  autoClose = true,
  autoCloseDuration = 3000
}: SuccessModalProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isOpen && autoClose) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return prev - (100 / (autoCloseDuration / 50));
        });
      }, 50);

      return () => clearInterval(interval);
    }
    setProgress(100);
  }, [isOpen, autoClose, autoCloseDuration, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-5 py-6">
          {/* Success Icon */}
          <div className="p-4 bg-emerald-50 rounded-full">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {autoClose && (
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-50 ease-linear rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="w-full"
          >
            Bağla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
