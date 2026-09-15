"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowDown, ArrowRight, CalendarDays, Check, ChevronDown, Globe2, Menu, SlidersHorizontal, Users, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LogoutButton } from "@/components/auth/LogoutButton"
import styles from "./home.module.css"

const examples = [
  { name: "Olive Studio", category: "Hair & beauty", eyebrow: "A little time for yourself", title: "Good hair.\nYour kind of care.", description: "Cuts, colour and a little breathing room. Find your next appointment at Olive Studio.", color: "#284b3c", background: "#f5f2eb", services: ["Cut & finish", "Colour consultation", "Blow dry"], prices: [45, 20, 30], durations: [45, 30, 30] },
  { name: "FORM Barbers", category: "Barbershops", eyebrow: "Considered cuts. Everyday confidence.", title: "Your chair\nis waiting.", description: "A fresh cut, a tidy beard, a familiar face. Make time for your next visit.", color: "#d8b47a", background: "#242823", services: ["Signature haircut", "Beard shape", "Cut & beard"], prices: [30, 18, 42], durations: [30, 20, 50] },
  { name: "The Quiet Room", category: "Wellness", eyebrow: "Space to slow down", title: "Make room\nfor yourself.", description: "Thoughtful treatments at your own pace. Choose a little time to reset.", color: "#835343", background: "#f4e9e2", services: ["Relaxation massage", "Facial treatment", "Deep tissue massage"], prices: [70, 55, 85], durations: [60, 45, 60] },
]
const features = [
  { icon: Globe2, title: "A website that feels like you", copy: "Bring your colours, photos and services together. Arrange the page in the visual editor and publish when it feels right." },
  { icon: CalendarDays, title: "Bookings on your terms", copy: "Set your opening hours, service durations and booking limits. Customers choose from the times you make available." },
  { icon: Users, title: "Your team, in one place", copy: "Add your team and let customers choose a staff member. Keep appointments and customer details together in your dashboard." },
  { icon: SlidersHorizontal, title: "Less back-and-forth", copy: "Share one booking link or QR code. Customers can return to their booking to reschedule or cancel without calling you." },
]
const faqs = [
  ["Is this a website builder or a booking tool?", "Both. Booklyt gives your business a customisable website with appointment booking built in. You manage your services, team and appointments from the same dashboard."],
  ["Do I need to know how to code?", "No. Start with a template, add your business details and edit the page visually. You can adjust the colours, text, photos and section order before publishing."],
  ["Can I use it for a team?", "Yes. Add your staff and services, set your opening hours and decide whether customers should choose a team member when booking."],
  ["How do customers find my website?", "Every business gets a shareable booking link. Put it in your Instagram bio, send it to customers or share your QR code at your business."],
  ["Does booking work in Arabic?", "Yes. The booking flow supports English and Arabic, including a right-to-left layout. Set the language for your business in your dashboard."],
]

export default function LandingPage() {
  const [dashboardHref, setDashboardHref] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exampleIndex, setExampleIndex] = useState(0)
  const [serviceIndex, setServiceIndex] = useState(0)
  const example = examples[exampleIndex]
  useEffect(() => {
    let active = true
    let authChanged = false
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true
      if (active) setDashboardHref(session?.user ? "/dashboard" : null)
    })
    supabase.auth.getUser().then(({ data }) => {
      if (active && !authChanged) setDashboardHref(data.user ? "/dashboard" : null)
    }).catch(() => {})
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const startHref = dashboardHref ?? "/auth/signup"
  return (
    <div className={styles.home}>
      <a className={styles.skipLink} href="#main">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo} aria-label="Booklyt home"><span className={styles.logoMark}><CalendarDays size={20} /></span>booklyt<span className={styles.logoDot}>.</span></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation"><a href="#features">The platform</a><a href="#templates">Website examples</a><a href="#how-it-works">How it works</a></nav>
          <div className={styles.navActions}>
            <Link className={`${styles.login} ${dashboardHref ? styles.dashboardLink : ""}`} href={dashboardHref ?? "/auth/login"}>{dashboardHref ? "Dashboard" : "Log in"}</Link>
            {dashboardHref ? <LogoutButton className={styles.logout} /> : <Link className={styles.smallButton} href={startHref}>Get started<ArrowRight size={15} /></Link>}
            <button className={styles.menuButton} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-navigation" className={styles.mobileNav} aria-label="Mobile navigation">{dashboardHref && <Link href={dashboardHref}>Dashboard<ArrowRight size={16} /></Link>}{[["The platform", "features"], ["Website examples", "templates"], ["How it works", "how-it-works"], ["Questions", "questions"]].map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}<ArrowRight size={16} /></a>)}</nav>}
      </header>
      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> YOUR BUSINESS. BEAUTIFULLY BOOKED.</p>
            <h1>A proper website.<br />A fuller calendar.<br /><em>More time for you.</em></h1>
            <p className={styles.heroDescription}>Your own booking website, with everything you need to manage appointments. Made for the people behind the business.</p>
            <div className={styles.heroActions}><Link className={styles.primaryButton} href={startHref}>Build your booking website<ArrowRight size={18} /></Link><a className={styles.textLink} href="#templates">Take a look inside<ArrowDown size={16} /></a></div>
            <div className={styles.heroNotes}><span><Check size={15} /> No coding needed</span><span><Check size={15} /> Your brand, your booking link</span></div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.visualLabel}><span>A website that works as hard as you do.</span><span>WEBSITE EXAMPLE</span></div>
            <div className={styles.browser}>
              <div className={styles.browserBar}><div><i /><i /><i /></div><span>booklyt.net/book/olive-studio</span><Globe2 size={12} /></div>
              <div className={styles.sampleNav}><span>olive<span className={styles.studioWord}> STUDIO</span></span><a href="#templates">Book a visit <ArrowRight size={12} /></a></div>
              <div className={styles.samplePhoto}><Image src="/images/salon-interior.jpg" alt="A salon with green walls, circular mirrors and styling chairs" fill priority sizes="(max-width: 900px) 95vw, 600px" /><div className={styles.photoCaption}><span>HAIR, WITH A PERSONAL TOUCH.</span><h2>Good hair.<br />Your kind of care.</h2></div></div>
              <div className={styles.sampleService}><div><span>MAKE YOURSELF AT HOME</span><p>A fresh start, from cut to colour.</p></div><a href="#templates" aria-label="Explore the salon website example"><ArrowRight size={20} /></a></div>
            </div>
            <div className={styles.appointmentCard}><span className={styles.appointmentCheck}><Check size={19} /></span><div><strong>That’s your next appointment.</strong><p>Cut & finish · Thursday, 10:30 am</p></div><span className={styles.exampleBadge}>Example</span></div>
            <p className={styles.visualFootnote}>Your look. Your services. One simple way to book.</p>
          </div>
        </section>
        <section className={styles.industries} aria-label="Who Booklyt is for"><p>For businesses built<br /><strong>around people.</strong></p><span>Barbers & salons</span><span>Beauty & wellness</span><span>Clinics & practices</span><span>Trainers & studios</span></section>
        <section id="features" className={styles.section}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>LESS ADMIN. MORE DOING.</p><h2>You take care of people.<br /><em>We’ll take care of the booking.</em></h2></div><p>A website out front. An organised business behind it. Everything connected, from the first visit to the next appointment.</p></div>
          <div className={styles.featureGrid}>{features.map(({ icon: Icon, title, copy }, i) => <article key={title} className={styles.feature}><div className={styles.featureTop}><Icon size={24} strokeWidth={1.5} /><span>0{i + 1}</span></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </section>
        <section id="templates" className={styles.templates}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>MAKE A GOOD FIRST IMPRESSION</p><h2>Your business has a personality.<br /><em>Your website should, too.</em></h2></div><p>Start with a style that fits. Make it yours with your own photos, words and colours.</p></div>
          <div className={styles.templateTabs} role="group" aria-label="Choose a website example">{examples.map((item, i) => <button key={item.name} aria-pressed={exampleIndex === i} onClick={() => { setExampleIndex(i); setServiceIndex(0) }} className={exampleIndex === i ? styles.activeTab : ""}>{item.category}<ArrowRight size={15} /></button>)}</div>
          <div className={styles.templatePreview} style={{ background: example.background, color: exampleIndex === 1 ? "#f6f2e9" : "#292f29", "--example-color": example.color } as React.CSSProperties}>
            <div className={styles.templateBrand}><strong>{example.name}</strong><span>ILLUSTRATIVE WEBSITE · TRY SELECTING A SERVICE</span></div>
            <div className={styles.templateBody}><div className={styles.templateStory}><p>{example.eyebrow}</p><h3>{example.title}</h3><p>{example.description}</p><span className={styles.templateSignature}>Time well spent.</span></div><div className={styles.exampleBooking}><div className={styles.bookingTitle}><CalendarDays size={19} /><strong>Plan your visit</strong><span>01</span></div><p>Choose your service</p>{example.services.map((name, i) => <button key={name} onClick={() => setServiceIndex(i)} aria-pressed={serviceIndex === i} className={serviceIndex === i ? styles.selectedService : ""}><span className={styles.radio}>{serviceIndex === i && <span />}</span><span><strong>{name}</strong><small>{example.durations[i]} minutes</small></span><b>${example.prices[i]}</b></button>)}<div className={styles.bookingSummary}><span>{example.durations[serviceIndex]} min · {example.services[serviceIndex]}</span><strong>${example.prices[serviceIndex]}</strong></div><Link href={startHref} className={styles.exampleCta}>Create a website like this<ArrowRight size={16} /></Link><small className={styles.demoNote}>Sample services and prices. No appointment is created.</small></div></div>
          </div>
          <div className={styles.templateCaption}><span>Three example businesses. A starting point for your own.</span><Link href={startHref}>Find your style<ArrowRight size={16} /></Link></div>
        </section>
        <section id="how-it-works" className={styles.section}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>FROM IDEA TO OPEN FOR BOOKINGS</p><h2>A small setup.<br /><em>A better working day.</em></h2></div><Link className={styles.textLink} href={startHref}>Let’s get you set up<ArrowRight size={17} /></Link></div>
          <div className={styles.steps}>{[["01", "Make yourself at home", "Choose a template. Add your business name, photos and the details that make you, you."], ["02", "Set your services and schedule", "Add prices, appointment lengths and your team. Decide when you’re available and how far ahead customers can book."], ["03", "Publish. Share. Get on with your day.", "Put your booking link in your bio, send it to a client or print your QR code. Your website is ready to welcome them."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </section>
        <section id="questions" className={styles.faq}><div><p className={styles.eyebrow}>A FEW GOOD QUESTIONS</p><h2>Before you<br /><em>make it yours.</em></h2></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></section>
        <section className={styles.closing}><div><p className={styles.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</p><h2>Let’s get your business<br /><em>beautifully booked.</em></h2></div><div><Link className={styles.lightButton} href={startHref}>Create your booking website<ArrowRight size={18} /></Link><p>Your business. Your brand. Your way.</p></div></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.logo}>booklyt.</Link><p>More time for the work you love.</p><nav aria-label="Footer navigation"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/auth/login">Business login</Link></nav><span>© {new Date().getFullYear()} Booklyt</span></footer>
    </div>
  )
}
