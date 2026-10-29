'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { login, getRolePath } from '@/lib/auth';
import { orgApi } from '@/lib/api';
import { getTenantConfigClient, type TenantConfig } from '@/lib/tenant';

const B = {
  teal:     '#90E0EF',
  tealDark: '#0096C7',
  tealBg:   '#E0F7FA',
  darkSec:  '#0A2E40',
  darkCard: '#0A1520',
  gray100:  '#161616',
  gray70:   '#525252',
  gray50:   '#8D8D8D',
  gray10:   '#F4F4F4',
  white:    '#FFFFFF',
  red:      '#C0392B',
  redBg:    '#FEF2F2',
};
const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError]   = useState('');
  const [tenant, setTenant] = useState<TenantConfig | null>(null);

  useEffect(() => { setTenant(getTenantConfigClient()); }, []);

  const accentColor = tenant?.primary_color  ?? B.tealDark;
  const navyColor   = tenant?.secondary_color ?? B.darkSec;
  const brandName   = tenant?.brand_name      ?? 'Shipmater';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      const user = await login(data.email, data.password);

      // Signing in from an invite link: join that company, then go to its verification checklist
      const inviteToken = new URLSearchParams(window.location.search).get('invite');
      if (inviteToken) {
        try {
          await orgApi.acceptInvitation(inviteToken);
          const info = (await orgApi.showInvitation(inviteToken)).data.data as { company_type: string | null };
          router.replace(`${getRolePath(user.role, info.company_type ?? undefined)}/verification`);
          return;
        } catch (e: unknown) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.error(msg ?? 'Could not accept the invitation. Ask for a new one.');
        }
      }

      router.replace(getRolePath(user.role, user.org?.type));
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg    = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 422 || status === 401) {
        setError(msg ?? 'Invalid email or password.');
      } else if (!status) {
        setError('Cannot reach the server. Please try again.');
      } else {
        setError(`Login failed (${status}): ${msg ?? 'unknown error'}`);
      }
    }
  }

  return (
    <div style={{
      fontFamily: BODY,
      WebkitFontSmoothing: 'antialiased',
      minHeight: '100vh',
      background: `linear-gradient(145deg, ${B.darkCard} 0%, ${navyColor} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
    }}>

      {/* Wordmark / Logo */}
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 36 }}>
        {tenant?.logo_url_dark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url_dark} alt={brandName} style={{ maxHeight: 40, maxWidth: 200, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 'var(--text-h5)', lineHeight: 'var(--lh-h5)', color: B.white, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            {brandName}
          </span>
        )}
      </Link>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: B.white,
        borderRadius: 10,
        padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.30)',
      }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 'var(--text-h5)', lineHeight: 'var(--lh-h5)', color: B.gray100, letterSpacing: '-0.02em', marginBottom: 6 }}>
          Sign in
        </h1>
        <p style={{ fontFamily: BODY, fontSize: 'var(--text-body)', lineHeight: 'var(--lh-body)', color: B.gray50, marginBottom: 28 }}>
          Welcome back to {brandName}
        </p>

        <form onSubmit={handleSubmit(onSubmit)}>

          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontFamily: BODY, fontSize: 13, fontWeight: 500, color: B.gray70, marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              style={{
                width: '100%',
                fontFamily: BODY,
                fontSize: 15,
                color: B.gray100,
                background: B.gray10,
                border: `1px solid ${errors.email ? B.red : 'transparent'}`,
                borderRadius: 6,
                padding: '10px 14px',
                boxSizing: 'border-box',
              }}
              className="outline-none focus:border-[#0096C7]"
              {...register('email')}
            />
            {errors.email && (
              <p style={{ fontFamily: BODY, fontSize: 12, color: B.red, marginTop: 4 }}>{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={{ fontFamily: BODY, fontSize: 13, fontWeight: 500, color: B.gray70 }}>
                Password
              </label>
              <Link href="/forgot-password" style={{ fontFamily: BODY, fontSize: 12, color: B.tealDark, textDecoration: 'none' }}
                className="hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%',
                fontFamily: BODY,
                fontSize: 15,
                color: B.gray100,
                background: B.gray10,
                border: `1px solid ${errors.password ? B.red : 'transparent'}`,
                borderRadius: 6,
                padding: '10px 14px',
                boxSizing: 'border-box',
              }}
              className="outline-none focus:border-[#0096C7]"
              {...register('password')}
            />
            {errors.password && (
              <p style={{ fontFamily: BODY, fontSize: 12, color: B.red, marginTop: 4 }}>{errors.password.message}</p>
            )}
          </div>

          {/* API error */}
          {error && (
            <div style={{ background: B.redBg, border: `1px solid #FECACA`, borderRadius: 6, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ fontFamily: BODY, fontSize: 13, color: B.red }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              fontFamily: BODY,
              fontSize: 15,
              fontWeight: 600,
              color: B.white,
              background: isSubmitting ? B.gray50 : accentColor,
              border: 'none',
              borderRadius: 6,
              padding: '12px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
            className="hover:opacity-90"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      {/* Register link */}
      <p style={{ fontFamily: BODY, fontSize: 14, color: 'rgba(255,255,255,0.50)', marginTop: 24 }}>
        Don&apos;t have an account?{' '}
        <Link href="/register" style={{ color: tenant ? B.teal : B.teal, fontWeight: 500, textDecoration: 'none' }}
          className="hover:underline">
          Create one
        </Link>
      </p>

      {/* "Powered by" — hidden if tenant opts out */}
      {tenant && !tenant.hide_powered_by && (
        <p style={{ fontFamily: BODY, fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 16 }}>
          Powered by Shipmater
        </p>
      )}

    </div>
  );
}
