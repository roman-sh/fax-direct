import { CircleHelp } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="mx-auto w-full max-w-6xl"
    >
      <Alert
        role="note"
        className="border-border/70 bg-card/65 px-4 py-3 sm:px-5"
      >
        <CircleHelp className="text-brand" aria-hidden="true" />
        <AlertTitle id="how-it-works-title">איך זה עובד?</AlertTitle>
        <AlertDescription className="leading-relaxed">
          מעלים מסמך, מזינים מספר פקס בישראל ומשלמים ₪10 בתשלום חד־פעמי
          באמצעות ביט. לאחר התשלום ניתן לעקוב אחר מצב השליחה בזמן אמת. אין צורך
          בהרשמה או במנוי. המסמך נמחק מהמערכת לאחר 24 שעות.
        </AlertDescription>
      </Alert>
    </section>
  )
}
