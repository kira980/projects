'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// ─── Copy ─────────────────────────────────────────────────────────────────────

const authText = {
  en: {
    eyebrow: 'Your account',
    signIn: 'Sign in',
    createAccount: 'Create account',
    welcome: 'Welcome back',
    welcomeSub: 'Sign in to keep your appointments in one place.',
    joinTitle: 'Create your account',
    joinSub: 'We verify your number on WhatsApp so your bookings stay yours.',
    phone: 'Phone',
    password: 'Password',
    fullName: 'Full name',
    phoneWhatsapp: 'Phone (WhatsApp)',
    namePlaceholder: 'Your name',
    passwordPlaceholder: 'At least 8 characters',
    signingIn: 'Signing in…',
    sendingCode: 'Sending code…',
    sendCode: 'Send WhatsApp code',
    codeNote: 'A 4-digit code will be sent to your WhatsApp.',
    checkWhatsapp: 'Check your WhatsApp',
    sentTo: 'We sent a code to',
    verificationCode: 'Verification code',
    verifying: 'Verifying…',
    verifyCreate: 'Verify & create account',
    changeNumber: 'Change number',
    resendIn: (s: number) => `Resend in ${s}s`,
    resend: 'Resend code',
    guest: 'Prefer not to sign in?',
    skip: 'Continue as guest',
    backToSite: 'Back to website',
    invalidPhone: 'Enter a valid phone number',
    passwordRequired: 'Password is required',
    nameTooShort: 'Name must be at least 2 characters',
    passwordTooShort: 'Password must be at least 8 characters',
    codeLength: 'Enter the 4-digit code',
    loginFailed: 'Login failed',
    sendFailed: 'Could not send code',
    verifyFailed: 'Verification failed',
  },
  ar: {
    eyebrow: 'حسابك',
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    welcome: 'أهلاً بعودتك',
    welcomeSub: 'سجّل الدخول لتبقى مواعيدك في مكان واحد.',
    joinTitle: 'أنشئ حسابك',
    joinSub: 'نتحقق من رقمك عبر واتساب لتبقى حجوزاتك محفوظة لك.',
    phone: 'رقم الهاتف',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    phoneWhatsapp: 'رقم الهاتف (واتساب)',
    namePlaceholder: 'اسمك',
    passwordPlaceholder: '8 أحرف على الأقل',
    signingIn: 'جارٍ تسجيل الدخول…',
    sendingCode: 'جارٍ إرسال الرمز…',
    sendCode: 'إرسال رمز واتساب',
    codeNote: 'سيصلك رمز من 4 أرقام عبر واتساب.',
    checkWhatsapp: 'تحقق من واتساب',
    sentTo: 'أرسلنا رمزاً إلى',
    verificationCode: 'رمز التحقق',
    verifying: 'جارٍ التحقق…',
    verifyCreate: 'تحقق وأنشئ الحساب',
    changeNumber: 'تغيير الرقم',
    resendIn: (s: number) => `إعادة الإرسال بعد ${s} ثانية`,
    resend: 'إعادة إرسال الرمز',
    guest: 'تفضّل بدون تسجيل؟',
    skip: 'المتابعة كضيف',
    backToSite: 'العودة إلى الموقع',
    invalidPhone: 'أدخل رقم هاتف صحيح',
    passwordRequired: 'كلمة المرور مطلوبة',
    nameTooShort: 'الاسم يجب ألا يقل عن حرفين',
    passwordTooShort: 'كلمة المرور يجب ألا تقل عن 8 أحرف',
    codeLength: 'أدخل الرمز المكوّن من 4 أرقام',
    loginFailed: 'تعذر تسجيل الدخول',
    sendFailed: 'تعذر إرسال الرمز',
    verifyFailed: 'فشل التحقق',
  },
} as const

type AuthCopy = { [K in keyof typeof authText.en]: (typeof authText.en)[K] }

// ─── Form ─────────────────────────────────────────────────────────────────────

export function CustomerAuthForm({ language = 'en' }: { language?: 'en' | 'ar' }) {
  const t = authText[language] as AuthCopy
  const arabic = language === 'ar'
  const params = useParams<{ businessSlug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') ?? `/book/${params.businessSlug}`

  const loginSchema = z.object({
    phone: z.string().min(7, t.invalidPhone),
    password: z.string().min(1, t.passwordRequired),
  })
  const registerSchema = z.object({
    full_name: z.string().min(2, t.nameTooShort),
    phone: z.string().min(7, t.invalidPhone),
    password: z.string().min(8, t.passwordTooShort),
  })
  const otpSchema = z.object({ code: z.string().length(4, t.codeLength) })

  type LoginForm = z.infer<typeof loginSchema>
  type RegisterForm = z.infer<typeof registerSchema>
  type OtpForm = z.infer<typeof otpSchema>

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [registerStep, setRegisterStep] = useState<'details' | 'otp'>('details')
  const [pendingRegister, setPendingRegister] = useState<RegisterForm | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) })

  function switchTab(next: 'login' | 'register') {
    setTab(next)
    setRegisterStep('details')
    setPendingRegister(null)
    setServerError(null)
  }

  async function onLogin(data: LoginForm) {
    setServerError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(body.error ?? t.loginFailed)
        return
      }
      router.replace(nextUrl)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function onRegisterDetails(data: RegisterForm) {
    setServerError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/customer/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone, purpose: 'register' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(body.error ?? t.sendFailed)
        return
      }
      setPendingRegister(data)
      setRegisterStep('otp')
      startCountdown(body.expires_in ?? 600)
    } finally {
      setLoading(false)
    }
  }

  async function onVerifyOtp(data: OtpForm) {
    if (!pendingRegister) return
    setServerError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/customer/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: pendingRegister.phone,
          code: data.code,
          password: pendingRegister.password,
          full_name: pendingRegister.full_name,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(body.error ?? t.verifyFailed)
        return
      }
      router.replace(nextUrl)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    if (!pendingRegister || otpCountdown > 0) return
    setServerError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/customer/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pendingRegister.phone, purpose: 'register' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(body.error ?? t.sendFailed)
        return
      }
      startCountdown(body.expires_in ?? 600)
      otpForm.reset()
    } finally {
      setLoading(false)
    }
  }

  function startCountdown(seconds: number) {
    setOtpCountdown(seconds)
    const iv = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  return (
    <div className="tenant-auth-card">
      <p className="site-kicker">{t.eyebrow}</p>
      <h1 className="tenant-auth-title">{tab === 'login' ? t.welcome : t.joinTitle}</h1>
      <p className="tenant-auth-sub">{tab === 'login' ? t.welcomeSub : t.joinSub}</p>

      <div className="tenant-auth-tabs" role="tablist">
        {(['login', 'register'] as const).map(value => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => switchTab(value)}
            className={tab === value ? 'is-active' : undefined}
          >
            {value === 'login' ? t.signIn : t.createAccount}
          </button>
        ))}
      </div>

      {serverError && <p className="tenant-auth-error" role="alert">{serverError}</p>}

      {tab === 'login' && (
        <form onSubmit={loginForm.handleSubmit(onLogin)} className="tenant-auth-form">
          <Field label={t.phone} error={loginForm.formState.errors.phone?.message}>
            <input {...loginForm.register('phone')} type="tel" dir="ltr" placeholder="+1 555 000 0000" autoComplete="tel" />
          </Field>
          <Field label={t.password} error={loginForm.formState.errors.password?.message}>
            <input {...loginForm.register('password')} type="password" placeholder="••••••••" autoComplete="current-password" />
          </Field>
          <button type="submit" disabled={loading} className="tenant-auth-submit">
            {loading ? t.signingIn : t.signIn}
          </button>
        </form>
      )}

      {tab === 'register' && registerStep === 'details' && (
        <form onSubmit={registerForm.handleSubmit(onRegisterDetails)} className="tenant-auth-form">
          <Field label={t.fullName} error={registerForm.formState.errors.full_name?.message}>
            <input {...registerForm.register('full_name')} type="text" placeholder={t.namePlaceholder} autoComplete="name" />
          </Field>
          <Field label={t.phoneWhatsapp} error={registerForm.formState.errors.phone?.message}>
            <input {...registerForm.register('phone')} type="tel" dir="ltr" placeholder="+1 555 000 0000" autoComplete="tel" />
          </Field>
          <Field label={t.password} error={registerForm.formState.errors.password?.message}>
            <input {...registerForm.register('password')} type="password" placeholder={t.passwordPlaceholder} autoComplete="new-password" />
          </Field>
          <button type="submit" disabled={loading} className="tenant-auth-submit">
            {loading ? t.sendingCode : t.sendCode}
          </button>
          <p className="tenant-auth-note">{t.codeNote}</p>
        </form>
      )}

      {tab === 'register' && registerStep === 'otp' && (
        <div className="tenant-auth-form">
          <div className="tenant-auth-note" style={{ textAlign: 'center' }}>
            <strong>{t.checkWhatsapp}</strong>
            <br />
            {t.sentTo} <span dir="ltr">{pendingRegister?.phone}</span>
          </div>
          <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="tenant-auth-form">
            <Field label={t.verificationCode} error={otpForm.formState.errors.code?.message}>
              <input
                {...otpForm.register('code')}
                type="text"
                inputMode="numeric"
                maxLength={4}
                dir="ltr"
                placeholder="1234"
                autoComplete="one-time-code"
                className="tenant-auth-code"
              />
            </Field>
            <button type="submit" disabled={loading} className="tenant-auth-submit">
              {loading ? t.verifying : t.verifyCreate}
            </button>
          </form>
          <div className="tenant-auth-row">
            <button type="button" onClick={() => { setRegisterStep('details'); setServerError(null) }}>
              {arabic ? `${t.changeNumber} →` : `← ${t.changeNumber}`}
            </button>
            {otpCountdown > 0
              ? <span>{t.resendIn(otpCountdown)}</span>
              : <button type="button" onClick={resendOtp} disabled={loading} className="is-primary">{t.resend}</button>}
          </div>
        </div>
      )}

      <p className="tenant-auth-note">
        {t.guest}{' '}
        <a href={`/book/${params.businessSlug}`} className="is-primary">{t.skip}</a>
      </p>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="tenant-auth-field">
      <span>{label}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </label>
  )
}
