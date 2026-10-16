'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';

async function call(path: string, init?: RequestInit) {
  const res = await fetch('/api' + path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Xəta baş verdi');
  return data;
}

// The link a manager hands a new client or lawyer: the password is chosen here.
function SetupPassword() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'checking' | 'ready' | 'bad' | 'done'>('checking');
  const [who, setWho] = useState({ name: '', email: '' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link natamamdır');
      setState('bad');
      return;
    }
    call('/auth/verify-setup-token?token=' + encodeURIComponent(token))
      .then((r) => {
        setWho({ name: r.name || '', email: r.email || '' });
        setState('ready');
      })
      .catch((e) => {
        setError(e.message);
        setState('bad');
      });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      setError('Parollar eyni deyil');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await call('/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      setState('done');
      setTimeout(() => router.push('/login'), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F07B6E] focus:border-transparent transition-all';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#F07B6E] to-purple-600 rounded-2xl mb-4 shadow-lg">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Parol təyin edin</h1>
          {who.email && <p className="text-gray-400 mt-2">{who.name} · {who.email}</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {state === 'checking' && <Loader2 className="w-6 h-6 animate-spin text-[#F07B6E] mx-auto" />}
          {state === 'bad' && (
            <div className="text-center">
              <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-red-600">{error}</p>
              <p className="text-xs text-gray-500 mt-2">Menecerdən yeni link istəyin.</p>
            </div>
          )}
          {state === 'done' && (
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <p className="text-sm text-gray-800">Parol saxlandı. Giriş səhifəsinə keçirsiniz…</p>
            </div>
          )}
          {state === 'ready' && (
            <form onSubmit={submit} className="space-y-4">
              <input className={input} type="password" minLength={6} required placeholder="Yeni parol (min. 6 simvol)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <input className={input} type="password" minLength={6} required placeholder="Parolu təkrarlayın" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={busy} className="w-full py-3 bg-gradient-to-r from-[#F07B6E] to-purple-600 text-white font-semibold rounded-xl disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Saxla
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetupPassword />
    </Suspense>
  );
}
