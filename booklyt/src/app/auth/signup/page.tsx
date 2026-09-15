"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AuthShell } from "../AuthShell"
import styles from "../auth.module.css"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
})

type FormData = z.infer<typeof schema>

export default function SignupPage() {
  const [ready, setReady] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    resetField,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => setReady(true), [])

  const passwordValue = watch("password", "")

  const passwordChecks = [
    { label: "At least 8 characters", ok: passwordValue.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(passwordValue) },
    { label: "Contains a number", ok: /[0-9]/.test(passwordValue) },
  ]

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setSignupError(null)
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
      const supabase = createClient()
      // Supabase can wait on a slow network or an auth lock. Always give the
      // customer a way out, even if the underlying request has not settled.
      const { data: signUpData, error } = await Promise.race([
        supabase.auth.signUp({
          email: data.email.trim(),
          password: data.password,
          options: {
            data: { full_name: data.fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(
            "Account creation is taking longer than expected. Check your email for a confirmation link, or try signing in before submitting again."
          )), 20_000)
        }),
      ])

      if (error) throw error
      if (!signUpData.user) {
        throw new Error("We could not confirm your account was created. Please try signing in or try again.")
      }

      // Email-confirmed projects return a user without a signed-in session.
      // Sending that user to onboarding would bounce them back to login.
      if (!signUpData.session) {
        setConfirmationEmail(data.email.trim())
        resetField("password")
        return
      }

      // Onboarding already ensures the profile before creating the business.
      // Do not block this navigation on a second network request.
      window.location.assign("/onboarding")
    } catch (error) {
      setSignupError(error instanceof Error ? error.message : "We couldn't create your account. Please check your connection and try again.")
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  return (
    <AuthShell mode="signup">
          <div className="mb-8">
            <h1 className={styles.title}>{confirmationEmail ? "Check your email" : "Create your account"}</h1>
            <p className="text-zinc-500 text-sm">
              Already have one?{" "}
              <Link href="/auth/login" className="text-zinc-900 font-medium hover:underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>

          {confirmationEmail ? (
            <div className="space-y-5">
              <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-950">
                <CheckCircle2 className="mb-3 h-6 w-6" />
                <p>Check <strong className="break-all">{confirmationEmail}</strong> for a confirmation link to finish creating your account.</p>
                <p className="mt-3">Once your email is confirmed, you can set up your business. If you already have an account, sign in instead.</p>
              </div>
              <p className="text-sm text-zinc-500">Can’t find it? Check your spam folder and make sure the email address is correct.</p>
              <Link href="/auth/login" className={styles.submit}>Continue to sign in</Link>
              <button type="button" className="w-full text-sm text-zinc-600 underline underline-offset-4" onClick={() => setConfirmationEmail(null)}>Use a different email</button>
            </div>
          ) : (
            <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={loading}>
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-[13px] font-medium text-zinc-600">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Alex Johnson"
                  autoComplete="name"
                  className="h-11 rounded-xl border-zinc-200 bg-white focus-visible:ring-1 focus-visible:ring-zinc-950 focus-visible:border-zinc-950 placeholder:text-zinc-300"
                  {...register("fullName")}
                />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium text-zinc-600">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@yourbusiness.com"
                  autoComplete="email"
                  className="h-11 rounded-xl border-zinc-200 bg-white focus-visible:ring-1 focus-visible:ring-zinc-950 focus-visible:border-zinc-950 placeholder:text-zinc-300"
                  {...register("email")}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-medium text-zinc-600">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    className="h-11 rounded-xl border-zinc-200 bg-white focus-visible:ring-1 focus-visible:ring-zinc-950 focus-visible:border-zinc-950 placeholder:text-zinc-300"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordValue && (
                  <ul className="mt-2 space-y-1.5">
                    {passwordChecks.map((check) => (
                      <li key={check.label} className="flex items-center gap-1.5 text-xs">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 transition-colors ${check.ok ? "text-emerald-500" : "text-zinc-200"}`}
                        />
                        <span className={`transition-colors ${check.ok ? "text-emerald-600" : "text-zinc-400"}`}>
                          {check.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {errors.password && !passwordValue && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <noscript><p className="text-sm text-red-700">Please enable JavaScript to create your account.</p></noscript>
              {signupError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{signupError}</p>}

              <Button
                type="submit"
                variant="dark"
                className={styles.submit}
                disabled={!ready || loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          )}

          <p className="mt-8 text-xs text-zinc-400 text-center leading-relaxed">
            By signing up you agree to our{" "}
            <Link href="/terms">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
    </AuthShell>
  )
}
