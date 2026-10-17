'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2, LogOut, Pencil, Plus, Scale, ShieldCheck, UserPlus, X } from 'lucide-react';

// ============================================================
// Super admin paneli: büroları yaratmaq və idarə etmək.
// Hər büronun öz bazası, öz ünvanları (domenləri) və öz e-poçt ayarı var.
// ============================================================

const K_TOKEN = 'super_token';

interface Tenant {
  id: number;
  name: string;
  db_name: string;
  is_active: boolean;
  created_at: string;
  domains: { host: string }[];
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_from: string;
  smtp_from_name: string;
  smtp_password_set: boolean;
  counts?: Record<string, number>;
  error?: string;
}

function token(): string {
  try {
    return localStorage.getItem(K_TOKEN) || '';
  } catch (e) {
    return '';
  }
}

async function call(path: string, method = 'GET', body?: any): Promise<any> {
  const res = await fetch('/api/super' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') {
    try {
      localStorage.removeItem(K_TOKEN);
    } catch (e) {}
    window.location.reload();
  }
  if (!res.ok) throw new Error(data.error || 'Xəta baş verdi');
  return data;
}

const input =
  'w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30 focus:border-[#4F46E5]';
const primary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] disabled:opacity-60';
const ghost =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs font-medium text-[#334155] hover:bg-[#F1F5F9]';

const hosts = (text: string) => text.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean);

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.4)] p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#475569] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await call('/login', 'POST', { email, password });
      localStorage.setItem(K_TOKEN, r.token);
      onIn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0F172A] flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-[#0F172A]">Super admin</h1>
        </div>
        <input className={input} type="email" required placeholder="E-poçt" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <input className={input} type="password" required placeholder="Parol" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="text-sm text-[#B91C1C]">{error}</p>}
        <button disabled={busy} className={primary + ' w-full'}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Daxil ol
        </button>
      </form>
    </div>
  );
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; t: Tenant }
  | { kind: 'password'; t: Tenant }
  | { kind: 'admin'; t: Tenant }
  | { kind: 'own' }
  | null;

function Panel({ onOut }: { onOut: () => void }) {
  const [list, setList] = useState<Tenant[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const load = useCallback(() => {
    call('/tenants')
      .then((r) => setList(r.data))
      .catch((e) => toast.error(e.message));
  }, []);
  useEffect(load, [load]);

  const open = (d: Dialog) => {
    setDialog(d);
    if (d && d.kind === 'edit')
      setF({
        name: d.t.name,
        domains: d.t.domains.map((x) => x.host).join('\n'),
        is_active: d.t.is_active,
        smtp_host: d.t.smtp_host,
        smtp_port: d.t.smtp_port,
        smtp_user: d.t.smtp_user,
        smtp_from: d.t.smtp_from,
        smtp_from_name: d.t.smtp_from_name,
      });
    else setF({});
  };

  const run = async (fn: () => Promise<any>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setDialog(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    if (dialog.kind === 'create')
      run(
        () => call('/tenants', 'POST', { name: f.name, domains: hosts(f.domains || ''), admin: { name: f.admin_name, email: f.admin_email, password: f.admin_password } }),
        'Büro yaradıldı',
      );
    if (dialog.kind === 'edit')
      run(
        () =>
          call('/tenants/' + dialog.t.id, 'PUT', {
            name: f.name,
            is_active: !!f.is_active,
            domains: hosts(f.domains || ''),
            mail: { host: f.smtp_host || '', port: f.smtp_port || '', user: f.smtp_user || '', password: f.smtp_password || '', from: f.smtp_from || '', from_name: f.smtp_from_name || '' },
          }),
        'Saxlanıldı',
      );
    if (dialog.kind === 'password')
      run(() => call('/tenants/' + dialog.t.id + '/password', 'POST', { email: f.email, password: f.password }), 'Parol dəyişdirildi');
    if (dialog.kind === 'admin')
      run(() => call('/tenants/' + dialog.t.id + '/admin', 'POST', { name: f.admin_name, email: f.admin_email, password: f.admin_password }), 'Menecer yaradıldı');
    if (dialog.kind === 'own')
      run(() => call('/password', 'POST', { current_password: f.current, new_password: f.next }), 'Parolunuz dəyişdirildi');
  };

  const adminFields = (
    <>
      <Field label="Menecerin adı">
        <input className={input} required value={f.admin_name || ''} onChange={set('admin_name')} />
      </Field>
      <Field label="Menecerin e-poçtu">
        <input className={input} type="email" required value={f.admin_email || ''} onChange={set('admin_email')} />
      </Field>
      <Field label="Menecerin parolu (min. 6 simvol)">
        <input className={input} type="password" minLength={6} required value={f.admin_password || ''} onChange={set('admin_password')} autoComplete="new-password" />
      </Field>
    </>
  );

  const domainsField = (
    <Field label="Domenlər (hər sətirdə bir; məs. trivo.az, www.trivo.az)">
      <textarea className={input + ' min-h-[80px]'} required value={f.domains || ''} onChange={set('domains')} placeholder="trivo.az" />
    </Field>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-[#0F172A]">
            <ShieldCheck className="w-5 h-5 text-[#4F46E5]" /> Super admin
          </div>
          <div className="flex items-center gap-2">
            <button className={ghost} onClick={() => open({ kind: 'own' })}>
              <KeyRound className="w-3.5 h-3.5" /> Parolum
            </button>
            <button className={ghost} onClick={onOut}>
              <LogOut className="w-3.5 h-3.5" /> Çıxış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A]">Bürolar</h1>
            <p className="text-sm text-[#64748B]">Hər büro öz domenində açılır, məlumatı və faylları ayrıca saxlanılır.</p>
          </div>
          <button className={primary} onClick={() => open({ kind: 'create' })}>
            <Plus className="w-4 h-4" /> Yeni büro
          </button>
        </div>

        {!list && <Loader2 className="w-6 h-6 animate-spin text-[#4F46E5]" />}
        {list && list.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-10 text-center text-sm text-[#64748B]">Hələ büro yoxdur.</div>
        )}
        <div className="grid gap-4">
          {list?.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5 text-[#4F46E5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0F172A]">{t.name}</span>
                      <span className={'text-[11px] font-semibold px-2 py-0.5 rounded-full ' + (t.is_active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F1F5F9] text-[#64748B]')}>
                        {t.is_active ? 'Aktiv' : 'Dayandırılıb'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {t.domains.map((d) => (
                        <a key={d.host} href={'https://' + d.host} target="_blank" rel="noreferrer" className="text-sm text-[#4F46E5] hover:underline">
                          {d.host}
                        </a>
                      ))}
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Baza: {t.db_name} · E-poçt: {t.smtp_host ? t.smtp_from || t.smtp_host : 'serverin ümumi ayarı'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={ghost} onClick={() => open({ kind: 'edit', t })}>
                    <Pencil className="w-3.5 h-3.5" /> Dəyiş
                  </button>
                  <button className={ghost} onClick={() => open({ kind: 'password', t })}>
                    <KeyRound className="w-3.5 h-3.5" /> Parol
                  </button>
                  {t.counts && (
                    <button className={ghost} onClick={() => open({ kind: 'admin', t })}>
                      <UserPlus className="w-3.5 h-3.5" /> Menecer əlavə et
                    </button>
                  )}
                </div>
              </div>
              {t.error && <p className="text-sm text-[#B91C1C] mt-3">{t.error}</p>}
              {t.counts && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
                  {[
                    ['managers', 'Menecer'],
                    ['lawyers', 'Vəkil'],
                    ['clients', 'Müştəri'],
                    ['contracts', 'Müqavilə'],
                    ['tasks', 'Tapşırıq'],
                    ['users', 'Hesab'],
                  ].map(([k, l]) => (
                    <div key={k} className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                      <div className="text-lg font-bold text-[#0F172A]">{t.counts?.[k] ?? 0}</div>
                      <div className="text-[11px] text-[#64748B]">{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {dialog && (
        <Modal
          title={
            dialog.kind === 'create'
              ? 'Yeni büro'
              : dialog.kind === 'edit'
                ? dialog.t.name
                : dialog.kind === 'password'
                  ? 'İstifadəçiyə yeni parol — ' + dialog.t.name
                  : dialog.kind === 'admin'
                    ? 'Menecer əlavə et — ' + dialog.t.name
                    : 'Parolumu dəyiş'
          }
          onClose={() => setDialog(null)}
        >
          <form onSubmit={submit} className="space-y-3">
            {dialog.kind === 'create' && (
              <>
                <Field label="Büronun adı">
                  <input className={input} required value={f.name || ''} onChange={set('name')} />
                </Field>
                {domainsField}
                <p className="text-xs text-[#64748B] pt-1">Büronun ilk meneceri:</p>
                {adminFields}
              </>
            )}
            {dialog.kind === 'edit' && (
              <>
                <Field label="Büronun adı">
                  <input className={input} required value={f.name || ''} onChange={set('name')} />
                </Field>
                {domainsField}
                <label className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <input type="checkbox" checked={!!f.is_active} onChange={set('is_active')} /> Aktivdir (dayandırılsa heç kim daxil ola bilmir)
                </label>
                <p className="text-xs font-semibold text-[#475569] pt-2">E-poçt göndərmə (SMTP) — boş qalsa serverin ümumi ayarı işləyir</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Server">
                      <input className={input} value={f.smtp_host || ''} onChange={set('smtp_host')} placeholder="smtp.gmail.com" />
                    </Field>
                  </div>
                  <Field label="Port">
                    <input className={input} value={f.smtp_port || ''} onChange={set('smtp_port')} placeholder="587" />
                  </Field>
                </div>
                <Field label="İstifadəçi">
                  <input className={input} value={f.smtp_user || ''} onChange={set('smtp_user')} autoComplete="off" />
                </Field>
                <Field label={dialog.t.smtp_password_set ? 'Parol (saxlanılıb; dəyişmək üçün yenisini yazın)' : 'Parol'}>
                  <input className={input} type="password" value={f.smtp_password || ''} onChange={set('smtp_password')} autoComplete="new-password" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Göndərən ünvan">
                    <input className={input} type="email" value={f.smtp_from || ''} onChange={set('smtp_from')} placeholder="no-reply@trivo.az" />
                  </Field>
                  <Field label="Göndərənin adı">
                    <input className={input} value={f.smtp_from_name || ''} onChange={set('smtp_from_name')} placeholder={dialog.t.name} />
                  </Field>
                </div>
              </>
            )}
            {dialog.kind === 'password' && (
              <>
                <Field label="İstifadəçinin e-poçtu">
                  <input className={input} type="email" required value={f.email || ''} onChange={set('email')} />
                </Field>
                <Field label="Yeni parol (min. 6 simvol)">
                  <input className={input} type="password" minLength={6} required value={f.password || ''} onChange={set('password')} autoComplete="new-password" />
                </Field>
              </>
            )}
            {dialog.kind === 'admin' && adminFields}
            {dialog.kind === 'own' && (
              <>
                <Field label="Cari parol">
                  <input className={input} type="password" required value={f.current || ''} onChange={set('current')} autoComplete="current-password" />
                </Field>
                <Field label="Yeni parol (min. 8 simvol)">
                  <input className={input} type="password" minLength={8} required value={f.next || ''} onChange={set('next')} autoComplete="new-password" />
                </Field>
              </>
            )}
            <button disabled={busy} className={primary + ' w-full mt-2'}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Saxla
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function SuperPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => setSignedIn(!!token()), []);
  if (signedIn === null) return null;
  if (!signedIn) return <Login onIn={() => setSignedIn(true)} />;
  return (
    <Panel
      onOut={() => {
        try {
          localStorage.removeItem(K_TOKEN);
        } catch (e) {}
        setSignedIn(false);
      }}
    />
  );
}
