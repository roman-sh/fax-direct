import type { Metadata } from "next"

import { LegalPage, LegalSection } from "@/components/legal-page"
import { getLegalConfig } from "@/server/config/legal-config.service"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "מדיניות פרטיות | Fax Direct",
}

export default async function PrivacyPage() {
  const legal = await getLegalConfig("IL")

  return (
    <LegalPage title="מדיניות פרטיות">
      <LegalSection title="מי אחראי למידע">
        <p>
          השירות מופעל בידי {legal.operatorName}, עוסק פטור{" "}
          {legal.businessNumber}, {legal.address}. לשאלות ולבקשות בנושא פרטיות
          ניתן לכתוב ל־
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="mailto:support@fax.direct"
          >
            support@fax.direct
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="המידע שנאסף">
        <p>
          לצורך מתן השירות נשמרים המסמך שהעליתם, שם הקובץ, מספר העמודים, מספר
          הפקס של הנמען, מזהה הפעלה ומצב השליחה. נשמרים גם סכום ואמצעי התשלום,
          מזהי העסקה שמתקבלים מספק התשלום ומידע תפעולי הדרוש לטיפול בתקלות.
        </p>
        <p>
          פרטי אמצעי התשלום המלאים אינם נמסרים ל־Fax Direct ומעובדים בעמוד
          התשלום של PayMe.
        </p>
      </LegalSection>

      <LegalSection title="מטרות השימוש">
        <p>
          המידע משמש להכנת הפקס ושליחתו, לעיבוד התשלום, להצגת מצב השליחה בזמן
          אמת, למניעת שימוש לרעה, לטיפול בתקלות ובפניות ולמילוי חובות משפטיות,
          חשבונאיות ואבטחת מידע.
        </p>
      </LegalSection>

      <LegalSection title="ספקים חיצוניים">
        <p>
          השירות נעזר ב־Cloudflare לאירוח ולאחסון, ב־PayMe לעיבוד התשלום
          וב־InterFAX לשליחת הפקס. לכל ספק נמסר רק המידע הדרוש לביצוע תפקידו,
          והמידע עשוי להישמר או להיות מעובד גם מחוץ לישראל בהתאם לתשתיות הספק.
        </p>
      </LegalSection>

      <LegalSection title="שמירת המידע">
        <p>
          קובץ ה־PDF נשמר באחסון פרטי ונמחק ממנו אוטומטית בתוך 24 שעות.
          InterFAX מוגדר למחוק את עותק הפקס לאחר השלמת הטיפול בו. נתוני עסקה,
          מצב שליחה ורישומים תפעוליים עשויים להישמר למשך הזמן הדרוש לתפעול,
          טיפול בפניות, אבטחה ועמידה בחובות משפטיות וחשבונאיות.
        </p>
      </LegalSection>

      <LegalSection title="עוגיות ואבטחה">
        <p>
          האתר משתמש בעוגייה חיונית ומאובטחת כדי לזהות את הפעלת הפקס ולאפשר
          שחזור של המצב לאחר רענון העמוד. לא נעשה בה שימוש לפרסום מותאם אישית.
          ננקטים אמצעים סבירים להגנת המידע, אך אין מערכת שמספקת אבטחה מוחלטת.
        </p>
      </LegalSection>

      <LegalSection title="הזכויות שלכם">
        <p>
          ניתן לפנות ל־
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="mailto:support@fax.direct"
          >
            support@fax.direct
          </a>{" "}
          בבקשה לעיין במידע אישי, לתקן אותו או למחוק אותו. הבקשה תטופל בהתאם
          לדין ובכפוף למידע שחובה או שיש צורך לגיטימי לשמור.
        </p>
      </LegalSection>

      <LegalSection title="עדכונים">
        <p>
          מדיניות זו עשויה להתעדכן בעקבות שינוי בשירות או בדרישות הדין. הנוסח
          המעודכן יפורסם בעמוד זה.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
