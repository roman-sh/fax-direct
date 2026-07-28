import {
  ArrowLeft,
  Check,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const steps = ["העלאת מסמך", "פרטי נמען", "אישור ותשלום"]

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,oklch(0.94_0.025_244),transparent_34rem)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <FileText className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Fax Direct</p>
            <p className="text-xs text-muted-foreground">
              פקס פשוט. בלי מכשיר.
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="h-7 border-primary/20 bg-primary/5 px-3 text-primary"
        >
          <ShieldCheck data-icon="inline-start" />
          מאובטח ופרטי
        </Badge>
      </header>

      <main className="mx-auto grid w-full max-w-6xl items-start gap-10 px-5 pb-16 pt-6 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1.15fr)] lg:gap-16 lg:pt-16">
        <section className="pt-2 lg:sticky lg:top-10">
          <Badge
            variant="secondary"
            className="mb-5 h-7 bg-primary/8 px-3 text-primary"
          >
            שליחת פקס בישראל
          </Badge>
          <h1 className="max-w-xl text-4xl leading-[1.15] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            שולחים פקס.
            <br />
            פשוט ובלי להסתבך.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            מעלים קובץ PDF, מזינים את מספר הנמען ומאשרים. אנחנו נדאג לכל
            השאר.
          </p>

          <div className="mt-9 grid max-w-lg gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    index === 0
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground"
                  }`}
                >
                  {index === 0 ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={
                    index === 0
                      ? "text-sm font-medium"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Card className="gap-0 border-0 py-0 shadow-[0_20px_70px_-30px_oklch(0.35_0.08_245/0.35)] ring-black/8">
          <CardHeader className="gap-1.5 border-b px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">הפקס שלך</CardTitle>
                <CardDescription className="mt-1">
                  מתחילים בהעלאת המסמך ופרטי הנמען
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0">
                עד 10 עמודים
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="px-5 py-6 sm:px-7 sm:py-7">
            <FieldGroup className="gap-7">
              <Field>
                <FieldLabel htmlFor="fax-file">קובץ PDF</FieldLabel>
                <label
                  htmlFor="fax-file"
                  className="group flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/[0.035] px-6 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/[0.06]"
                >
                  <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5">
                    <Upload className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-base font-medium">
                    לחצו לבחירת קובץ PDF
                  </span>
                  <span className="mt-1.5 text-sm text-muted-foreground">
                    או גררו את הקובץ לכאן
                  </span>
                  <span className="mt-4 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground ring-1 ring-border">
                    PDF בלבד · עד 10 עמודים
                  </span>
                </label>
                <input
                  id="fax-file"
                  name="fax-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                />
                <FieldDescription>
                  מספר העמודים יאומת באופן מאובטח לאחר ההעלאה.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="recipient-fax">
                  מספר הפקס של הנמען
                </FieldLabel>
                <Input
                  id="recipient-fax"
                  name="recipient-fax"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="03-1234567"
                  className="h-11 px-3 text-left text-base"
                />
                <FieldDescription>
                  מספר ישראלי כולל קידומת אזור.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="mt-7 flex items-center justify-between rounded-xl bg-muted/65 px-4 py-4">
              <div>
                <p className="text-sm font-medium">מחיר קבוע לפקס</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  למסמך של עד 10 עמודים
                </p>
              </div>
              <div className="text-left">
                <span className="text-2xl font-semibold tracking-tight">
                  ₪9.90
                </span>
                <p className="text-xs text-muted-foreground">כולל מע״מ</p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3 border-t bg-card px-5 py-5 sm:px-7">
            <Button className="h-11 w-full text-base" disabled>
              המשך לבדיקה
              <ArrowLeft data-icon="inline-end" />
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              לא תחויבו לפני הצגת כל הפרטים ואישורכם
            </p>
          </CardFooter>
        </Card>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-center border-t border-border/70 px-5 py-5 text-center text-xs text-muted-foreground sm:px-8">
        Fax Direct · שירות שליחת פקס דיגיטלי
      </footer>
    </div>
  )
}
