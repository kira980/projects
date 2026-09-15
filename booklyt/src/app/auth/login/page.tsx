"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AuthShell } from "../AuthShell"
import styles from "../auth.module.css"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      toast({ variant: "destructive", title: "Login failed", description: error.message })
      setLoading(false)
      return
    }

    window.location.href = "/dashboard"
  }

  return (
    <AuthShell mode="login">
          <div className="mb-8">
            <h1 className={styles.title}>Log in</h1>
            <p className="text-zinc-500 text-sm">
              No account?{" "}
              <Link href="/auth/signup" className="text-zinc-900 font-medium hover:underline underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-zinc-600">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 rounded-xl border-zinc-200 bg-white focus-visible:ring-1 focus-visible:ring-zinc-950 focus-visible:border-zinc-950 placeholder:text-zinc-300"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-zinc-600">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              variant="dark"
              className={styles.submit}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-8 text-xs text-zinc-400 text-center leading-relaxed">
            By signing in you agree to our{" "}
            <Link href="/terms">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
    </AuthShell>
  )
}
