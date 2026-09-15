import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BOOKLYT } from '@/lib/booklyt'

export const metadata = { title: `Terms of Service · ${BOOKLYT.appName}` }

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-zinc-400 mb-8">Last updated: July 2026</p>

      <div className="space-y-6 text-sm leading-6 text-zinc-700">
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">The service</h2>
          <p>
            {BOOKLYT.appName} lets you discover businesses and book appointments with them. The
            businesses on the platform are independent — they set their own services, prices, hours,
            and policies. Your appointment is an agreement between you and the business.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Your account</h2>
          <p>
            You sign in with your phone number, verified by a one-time code. Keep your number up to
            date and don&apos;t share verification codes. You are responsible for bookings made from your
            account.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Bookings and cancellations</h2>
          <p>
            Please cancel or reschedule in good time if you can&apos;t attend. Businesses may have their own
            cancellation policies. Repeated no-shows may limit your ability to book.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Acceptable use</h2>
          <p>
            Don&apos;t misuse the platform: no fraudulent bookings, no harassment of businesses or staff,
            and no attempts to access data that isn&apos;t yours.
          </p>
        </section>
        <section>
          <h2 className="font-bold text-zinc-900 mb-1">Contact</h2>
          <p>
            Questions about these terms: <a className="text-violet-600 underline" href="mailto:support@booklyt.net">support@booklyt.net</a>
          </p>
        </section>
      </div>
    </div>
  )
}
