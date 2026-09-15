import Link from "next/link"
import { Calendar, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-6">
        <Calendar className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-zinc-500 mb-6 text-center">
        This page doesn&apos;t exist, or the booking page you&apos;re looking for is unavailable.
      </p>
      <Link href="/">
        <Button variant="outline">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Button>
      </Link>
    </div>
  )
}
