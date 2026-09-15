import { MessageCircle } from 'lucide-react'

export default function MessagesPage() {
  return (
    <div className="px-5 pt-14 pb-8">
      <h1 className="text-2xl font-extrabold text-zinc-900 mb-1">Messages</h1>
      <p className="text-zinc-400 text-sm mb-8">Your conversations with businesses</p>

      <div className="flex flex-col items-center justify-center py-16 text-zinc-300">
        <MessageCircle className="w-16 h-16 mb-4 opacity-40" strokeWidth={1.5} />
        <p className="font-semibold text-zinc-500 text-base">No messages yet</p>
        <p className="text-zinc-400 text-sm mt-1 text-center">
          When businesses send you updates,<br />they&apos;ll appear here.
        </p>
      </div>
    </div>
  )
}
