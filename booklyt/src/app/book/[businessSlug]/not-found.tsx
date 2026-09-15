import Link from "next/link"
import { Calendar, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BookingNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-6">
        <Calendar className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Booking page not found</h1>
      <p className="text-zinc-500 mb-6 text-center max-w-sm">
        This business doesn&apos;t exist or their booking page has been disabled.
      </p>
      <Link href="/">
        <Button variant="outline">
          <ArrowLeft className="w-4 h-4" />
          Go to BookFlow
        </Button>
      </Link>
    </div>
  )
}
