import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BOOKLYT } from '@/lib/booklyt'

export const metadata = { title: `Privacy Policy · ${BOOKLYT.appName}` }

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-400 mb-8">Last updated: July 2026</p>

      <div className="space-y-6 text-sm leading-6 text-zinc-700">
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">What we collect</h2>
          <p>
            When you use {BOOKLYT.appName}, we collect the information you provide to make and manage
            bookings: your name, phone number, optional email address, and your appointment details.
            If you enable notifications, we also store a push token for your device.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">How we use it</h2>
          <p>
            Your information is used to create and manage your bookings, to let the businesses you book
            with contact you about your appointments, and to send you booking confirmations, reminders,
            and updates you have opted into. We do not sell your personal data.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Who sees your data</h2>
          <p>
            A business can only see your details if you booked with them or opened their page while
            signed in. Businesses can only send notifications to customers who have interacted with
            them, and you can mute any business at any time from your app.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Your choices</h2>
          <p>
            You can disable notifications per business or system-wide in your device settings. To
            request deletion of your account and associated data, contact us at the email below or use
            the account section in the app.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Contact</h2>
          <p>
            Questions about this policy: <a className="text-violet-600 underline" href="mailto:support@booklyt.net">support@booklyt.net</a>
          </p>
        </section>
      </div>
    </div>
  )
}
