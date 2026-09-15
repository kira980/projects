import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, CalendarDays, Check } from "lucide-react"
import styles from "./auth.module.css"

export function AuthShell({ children, mode }: { children: ReactNode; mode: "login" | "signup" }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Booklyt home"><span><CalendarDays size={20} /></span>booklyt<b>.</b></Link>
        <Link href="/" className={styles.back}><ArrowLeft size={15} /> Back to home</Link>
      </header>
      <main className={styles.main}>
        <section className={styles.story} aria-label="Your business with Booklyt">
          <h2>{mode === "login" ? <>A little less admin.<br /><em>More time for you.</em></> : <>Your business.<br /><em>Beautifully booked.</em></>}</h2>
          <p>Your own website. An organised calendar. More time for the people who make your business yours.</p>
          <div className={styles.photo}>
            <Image src="/images/salon-interior.jpg" alt="A welcoming salon with green walls and styling chairs" fill priority sizes="(max-width: 800px) 100vw, 480px" />
            <div className={styles.note}><span><Check size={18} /></span><div><strong>Make room for your next chapter.</strong><p>Your look. Your services. Your booking link.</p></div></div>
          </div>
        </section>
        <section className={styles.formPanel} aria-label={mode === "login" ? "Log in" : "Sign up"}>
          <div className={styles.formContent}>{children}</div>
        </section>
      </main>
      <footer className={styles.footer}>© {new Date().getFullYear()} Booklyt<span>More time for the work you love.</span></footer>
    </div>
  )
}
