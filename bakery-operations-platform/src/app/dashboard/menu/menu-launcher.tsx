"use client";

import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Launcher for the ported public menu (public/menu/index.html) and its
 * editor (public/menu/admin-easy.html). Both read/write this business's
 * real products via the menu compatibility views (migration 0016).
 */
export function MenuLauncher() {
  // Single-tenant: the menu pages resolve the only restaurant themselves,
  // so links need no ?id.
  const menuPath = `/menu/index.html`;
  const editorPath = `/menu/admin-easy.html`;

  function copyLink() {
    const url = `${window.location.origin}${menuPath}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("הקישור לתפריט הועתק"),
      () => toast.error("ההעתקה נכשלה")
    );
  }

  function shareWhatsApp() {
    const url = `${window.location.origin}${menuPath}`;
    const message = `שלום! הנה התפריט שלנו להזמנות:\n${url}`;
    // No phone number — WhatsApp opens its contact picker for the message.
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noreferrer"
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">תפריט</h1>
        <p className="text-muted-foreground">
          התפריט הציבורי מציג את המוצרים המסומנים &quot;זמין להזמנה
          אונליין&quot; במסך המוצרים. עריכת התפריט מעדכנת את אותם מוצרים.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>התפריט הציבורי</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink}>
            <Copy className="size-4" />
            העתקת קישור לתפריט
          </Button>
          <Button variant="outline" onClick={shareWhatsApp}>
            <MessageCircle className="size-4" />
            שליחה בוואטסאפ
          </Button>
          <Button variant="outline" asChild>
            <a href={menuPath} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              פתיחת התפריט
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>עריכת התפריט</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            מסך העריכה נפתח בכניסה נפרדת — שם המשתמש הוא כתובת האימייל שלכם
            והסיסמה זהה לכניסה לדשבורד.
          </p>
          <div>
            <Button asChild>
              <a href={editorPath} target="_blank" rel="noreferrer">
                <PencilRuler className="size-4" />
                פתיחת עורך התפריט
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
