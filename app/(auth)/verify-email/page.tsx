'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, MailCheck } from 'lucide-react';
import { authApi } from '@/lib/api';
import { getUser, getRolePath, logout } from '@/lib/auth';
import type { User } from '@/types/user';

/**
 * Sign-up, step 2: verify the email address. Nothing else in the app opens until this is done
 * (the dashboard sends unverified people here, and the API refuses them with email_not_verified).
 *   /verify-email              "Check your inbox", resend, and continue once verified
 *   /verify-email?token=…      the link from the email
 */
const B = {
  tealDark: '#0096C7', tealBg: '#E0F7FA', darkCard: '#0A1520', navy: '#0A2E40',
  gray100: '#161616', gray70: '#525252', gray50: '#8D8D8D', gray10: '#F4F4F4', white: '#FFFFFF', red: '#C0392B',
};
const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';
const RESEND_WAIT = 60;

const home = (u: User) => getRolePath(u.role, u.org?.type);

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: BODY, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px', background: `linear-gradient(145deg, ${B.darkCard} 0%, ${B.navy} 100%)`,
    }}>
      <div style={{ width: '100%', maxWidth: 480, background: B.white, borderRadius: 10, padding: '40px 36px', boxShadow: '0 24px 64px rgba(0,0,0,0.30)', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: B.gray50, marginBottom: 18 }}>
          Create an account · Step 2 of 2
        </p>
        {children}
      </div>
    </div>
  );
}

const h1 = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 'var(--text-h5)', color: B.gray100, letterSpacing: '-0.02em', marginBottom: 8 } as const;
const p  = { fontSize: 'var(--text-body)', lineHeight: 'var(--lh-body)', color: B.gray70 } as const;
const btn = (primary: boolean) => ({
  width: '100%', padding: '12px 16px', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer',
  border: primary ? 'none' : `1px solid ${B.gray10}`, background: primary ? B.tealDark : B.white, color: primary ? B.white : B.gray100,
}) as const;

/** The link from the email */
function VerifyToken({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    let cancelled = false;
    authApi.verifyEmail(token)
      .then(async (res) => {
        if (cancelled) return;
        setStatus('ok');
        setMessage(res.data?.message ?? 'Your email is verified.');
        // Signed in on this browser: carry on into the app; otherwise sign in first
        const user = await getUser().catch(() => null);
        setTimeout(() => router.replace(user ? home(user) : '/login'), 1500);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setStatus('error');
        setMessage(msg ?? 'This link is invalid or has expired.');
      });
    return () => { cancelled = true; };
  }, [token, router]);

  return (
    <Shell>
      {status === 'loading' && <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin" style={{ color: B.tealDark }} />}
      {status === 'ok' && <CheckCircle className="mx-auto mb-4 h-10 w-10 text-emerald-600" />}
      {status === 'error' && <XCircle className="mx-auto mb-4 h-10 w-10" style={{ color: B.red }} />}
      <h1 style={h1}>{status === 'error' ? 'Link not valid' : status === 'ok' ? 'Email verified' : 'Verifying'}</h1>
      <p style={p}>{message}</p>
      {status === 'ok' && <p style={{ ...p, marginTop: 8 }}>Taking you to your account…</p>}
      {status === 'error' && (
        <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
          <Link href="/verify-email" style={{ ...btn(true), display: 'block', textDecoration: 'none' }}>Send a new link</Link>
          <Link href="/login" style={{ fontSize: 14, color: B.tealDark }}>Back to sign in</Link>
        </div>
      )}
    </Shell>
  );
}

/** "Check your inbox": shown after sign-up, and whenever an unverified person opens the app */
function CheckInbox() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wait, setWait] = useState(RESEND_WAIT);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const check = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    const u = await getUser().catch(() => null);
    if (manual) setChecking(false);
    if (!u) { router.replace('/login'); return; }
    if (u.email_verified) { router.replace(home(u)); return; }
    setUser(u);
    if (manual) setNote({ text: "We haven't seen the click yet. Open the link in the email, then try again.", error: true });
  }, [router]);

  // Load the person, then keep checking so verifying in another tab carries on here
  useEffect(() => {
    check();
    const poll = setInterval(() => check(), 5000);
    return () => clearInterval(poll);
  }, [check]);

  // Resend countdown
  useEffect(() => {
    timer.current = setInterval(() => setWait((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer.current);
  }, []);

  async function resend() {
    setNote(null);
    try {
      const res = await authApi.resendVerification();
      setNote({ text: res.data?.message ?? 'We sent a new link.' });
      setWait(RESEND_WAIT);
    } catch (e: unknown) {
      const r = (e as { response?: { status?: number; data?: { message?: string } } })?.response;
      setNote({ text: r?.status === 429 ? 'Please wait a minute before asking again.' : (r?.data?.message ?? 'Could not send the email. Try again shortly.'), error: true });
    }
  }

  async function signOut() {
    await logout();
    router.replace('/register');
  }

  if (!user) {
    return <Shell><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: B.tealDark }} /></Shell>;
  }

  return (
    <Shell>
      <MailCheck className="mx-auto mb-4 h-11 w-11" style={{ color: B.tealDark }} />
      <h1 style={h1}>Verify your email</h1>
      <p style={p}>
        We sent a link to <strong style={{ color: B.gray100 }}>{user.email}</strong>. Open it to finish creating your account.
        The link works for 60 minutes.
      </p>

      {note && (
        <p style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, fontSize: 14, background: note.error ? '#FEF2F2' : B.tealBg, color: note.error ? B.red : B.navy }}>
          {note.text}
        </p>
      )}

      <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
        <button type="button" onClick={() => check(true)} disabled={checking} style={btn(true)}>
          {checking ? 'Checking…' : "I've verified, continue"}
        </button>
        <button type="button" onClick={resend} disabled={wait > 0} style={{ ...btn(false), opacity: wait > 0 ? 0.6 : 1, cursor: wait > 0 ? 'default' : 'pointer' }}>
          {wait > 0 ? `Resend email in ${wait}s` : 'Resend email'}
        </button>
      </div>

      <p style={{ ...p, fontSize: 13, marginTop: 20, color: B.gray50 }}>
        Can&apos;t find it? Check your spam folder. Wrong address?{' '}
        <button type="button" onClick={signOut} style={{ color: B.tealDark, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13 }}>
          Sign out and start again
        </button>
      </p>
    </Shell>
  );
}

function VerifyEmailInner() {
  const token = useSearchParams().get('token') ?? '';
  return token ? <VerifyToken token={token} /> : <CheckInbox />;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
