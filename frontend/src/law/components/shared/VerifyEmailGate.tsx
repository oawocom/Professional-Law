'use client';
import { useState } from 'react';
import { MailCheck, LogOut, Loader2, RotateCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { fetchApi } from '../../utils/apiHelper';
import { toast } from 'sonner';

interface VerifyEmailGateProps {
  email: string;
  onVerified: () => void;
  onLogout: () => void;
}

// Yeni yaradılan vəkil/müştəri hesabları giriş etdikdən sonra, öz panelinə
// keçid almazdan əvvəl bu ekranda e-poçtlarına göndərilən 6 rəqəmli kodu
// daxil etməlidirlər. Kod düzgündürsə backend email_verified=true edir və
// istifadəçi normal iş axınına buraxılır.
export function VerifyEmailGate({ email, onVerified, onLogout }: VerifyEmailGateProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError('Zəhmət olmasa e-poçtunuza göndərilən kodu daxil edin.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      await fetchApi('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ code: trimmed }),
      });
      toast.success('Hesabınız təsdiqləndi. Panelinizə yönləndirilirsiniz...');
      onVerified();
    } catch (err: any) {
      let message = 'Kod yanlışdır və ya vaxtı bitib.';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.error) message = parsed.error;
      } catch {}
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await fetchApi('/auth/resend-code', { method: 'POST' });
      toast.success('Yeni kod e-poçtunuza göndərildi.');
    } catch (err: any) {
      toast.error('Kod göndərilə bilmədi. Bir az sonra yenidən cəhd edin.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-2">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <MailCheck className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">E-poçtunuzu təsdiqləyin</CardTitle>
          <CardDescription>
            <span className="font-medium text-gray-700">{email}</span> ünvanına 6 rəqəmli təsdiq
            kodu göndərdik. Panelinizə keçid üçün kodu aşağıda daxil edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em] font-semibold h-14"
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>

          <Button onClick={handleVerify} disabled={verifying} className="w-full h-11">
            {verifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Yoxlanılır...</> : 'Təsdiq et'}
          </Button>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
              Kodu yenidən göndər
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Çıxış
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
