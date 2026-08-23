import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="shrink-0 border-t border-border/70 px-5 py-4 text-sm text-muted-foreground sm:px-8">
      <nav
        aria-label="מידע משפטי ויצירת קשר"
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
      >
        <Link className="hover:text-foreground" href="/terms">
          תנאי שימוש
        </Link>
        <Link className="hover:text-foreground" href="/privacy">
          מדיניות פרטיות
        </Link>
        <a
          className="hover:text-foreground"
          href="mailto:support@fax.direct"
          rel="noopener noreferrer"
          target="_blank"
        >
          support@fax.direct
        </a>
      </nav>
    </footer>
  )
}
