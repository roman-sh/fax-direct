import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal-page"
import { getLegalConfig } from "@/server/config/legal-config.service"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "תנאי שימוש | Fax Direct",
}

export default async function TermsPage() {
  const legal = await getLegalConfig("IL")

  return (
    <LegalPage title="תנאי שימוש">
      <LegalSection title="מפעיל השירות">
        <p>
          אתר Fax Direct מופעל בידי {legal.operatorName}, עוסק פטור{" "}
          {legal.businessNumber}, {legal.address}. לפניות ניתן לכתוב ל־
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="mailto:support@fax.direct"
          >
            support@fax.direct
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="השירות">
        <p>
          השירות מאפשר להעלות מסמך PDF, להזין מספר פקס ולבצע ניסיון שליחה חד־פעמי
          לאחר תשלום. המחיר, מגבלת העמודים ופרטי השליחה מוצגים לפני התשלום.
        </p>
        <p>
          מצב השליחה המוצג באתר מבוסס על המידע שמתקבל מספק הפקס. הצלחת השליחה
          תלויה גם במספר שהוזן, בקו של הנמען ובמערכות צד שלישי, ולכן אינה מובטחת.
        </p>
      </LegalSection>

      <LegalSection title="תשלום והתחלת השליחה">
        <p>
          לחיצה על כפתור התשלום מהווה בקשה להתחיל בשליחת הפקס באופן מיידי. לאחר
          אישור התשלום השליחה מתחילה אוטומטית, ולא ניתן לבטל אותה לאחר שהחלה.
        </p>
        <p>
          אם חויבתם אך ניסיון השליחה לא החל עקב תקלה בשירות, כתבו ל־
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="mailto:support@fax.direct"
          >
            support@fax.direct
          </a>
          . הפנייה תיבדק בהתאם לנסיבות ולהוראות הדין.
        </p>
      </LegalSection>

      <LegalSection title="אחריות המשתמשים">
        <p>
          עליכם לוודא שמספר הפקס נכון ושאתם רשאים לשלוח את המסמך לנמען. אין להשתמש
          בשירות לשליחת תוכן בלתי חוקי, מטעה, פוגעני, מטריד או מפר זכויות, או
          לשליחה המונית ללא הסכמה.
        </p>
      </LegalSection>

      <LegalSection title="תקלות וניסיונות חוזרים">
        <p>
          קו תפוס, היעדר מענה, מספר שגוי, דחייה מצד הנמען או תקלה בקו אינם בהכרח
          תקלה בשירות. כאשר האתר מאפשר ניסיון נוסף, ניתן לנסות שוב או לעדכן את
          המספר או המסמך בהתאם למצב המוצג.
        </p>
      </LegalSection>

      <LegalSection title="זמינות ואחריות">
        <p>
          השירות ניתן כפי שהוא ועשוי להיות מושפע מתחזוקה, תקלות תקשורת ושירותי
          צד שלישי. אין בתנאים אלה כדי לגרוע מזכויות שלא ניתן לוותר עליהן לפי דין.
        </p>
      </LegalSection>

      <LegalSection title="דין ושינויים">
        <p>
          על השימוש בשירות חל דין מדינת ישראל. ניתן לעדכן תנאים אלה מעת לעת;
          הנוסח המעודכן יפורסם בעמוד זה.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
