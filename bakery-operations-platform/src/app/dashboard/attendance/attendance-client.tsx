"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  Crosshair,
  MapPin,
  Wifi,
  Trash2,
  Check,
  TriangleAlert,
  Smartphone,
  Copy,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  saveLocation,
  registerCurrentNetwork,
  removeNetwork,
} from "./actions";

const GeofenceMap = dynamic(
  () => import("./geofence-map").then((m) => m.GeofenceMap),
  { ssr: false, loading: () => <div className="h-64 w-full rounded-lg border bg-muted/40" /> }
);

export type AttendanceSettings = {
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  allowedIps: string[];
  isActive: boolean;
  connectedDevices: number;
  activeWorkers: number;
};

const RADIUS_CHOICES = [50, 100, 150];

/** One line of the setup checklist. */
function StatusLine({
  ok,
  label,
  value,
}: {
  ok: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2">
        {ok ? (
          <Check className="size-4 text-success" aria-hidden />
        ) : (
          <TriangleAlert className="size-4 text-warning" aria-hidden />
        )}
        {label}
      </span>
      <span className={ok ? "text-muted-foreground" : "font-medium text-warning"}>
        {value}
      </span>
    </div>
  );
}

/**
 * נוכחות ומיקום — everything the owner needs to switch phone attendance on,
 * in the two steps that actually matter: stand at the work site and press
 * one button, then do the same on its Wi-Fi.
 */
export function AttendanceClient({
  settings,
  currentIp,
  installUrl,
}: {
  settings: AttendanceSettings;
  /** What this browser is seen as right now. */
  currentIp: string | null;
  /** Page the worker opens to put the app on their home screen. */
  installUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [radius, setRadius] = useState(settings.radiusM);
  const [fix, setFix] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);

  const lat = fix?.lat ?? settings.latitude;
  const lng = fix?.lng ?? settings.longitude;
  const hasLocation = lat !== null && lng !== null;
  const hasNetwork = settings.allowedIps.length > 0;
  const ipRegistered = !!currentIp && settings.allowedIps.includes(currentIp);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("הדפדפן לא תומך במיקום");
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPending(false);
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        toast.success("המיקום נקלט — לחצו שמירה כדי לאשר");
      },
      () => {
        setPending(false);
        toast.error("אין גישה למיקום. אשרו הרשאת מיקום בדפדפן.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  }

  async function onSaveLocation() {
    if (lat === null || lng === null) return;
    setPending(true);
    const result = await saveLocation(lat, lng, radius);
    setPending(false);
    if (result.ok) {
      toast.success(result.info);
      setFix(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onRegisterNetwork() {
    setPending(true);
    const result = await registerCurrentNetwork();
    setPending(false);
    if (result.ok) {
      toast.success(result.info);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  async function onRemoveNetwork(ip: string) {
    if (!confirm("להסיר את הרשת הזו? עובדים ברשת הזו לא יוכלו להחתים.")) return;
    setPending(true);
    const result = await removeNetwork(ip);
    setPending(false);
    if (result.ok) {
      toast.success(result.info);
      router.refresh();
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">מצב מערכת הנוכחות</CardTitle>
        </CardHeader>
        <CardContent className="grid divide-y text-sm">
          <StatusLine
            ok={hasLocation}
            label="מיקום מקום העבודה"
            value={hasLocation ? "מוגדר" : "לא הוגדר"}
          />
          <StatusLine
            ok={hasLocation}
            label="רדיוס מותר"
            value={`${settings.radiusM} מטר`}
          />
          <StatusLine
            ok={hasNetwork}
            label="רשת Wi-Fi"
            value={
              hasNetwork ? `${settings.allowedIps.length} רשתות` : "לא הוגדרה"
            }
          />
          <StatusLine
            ok={settings.connectedDevices > 0}
            label="טלפונים מחוברים"
            value={`${settings.connectedDevices} מתוך ${settings.activeWorkers} עובדים`}
          />
          <div className="flex items-center justify-between gap-3 pt-3">
            <span className="font-medium">מערכת הנוכחות</span>
            {settings.isActive ? (
              <Badge variant="success">פעילה</Badge>
            ) : (
              <Badge variant="warning">דרושה הגדרה</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" />
            אפליקציית הנוכחות לעובדים
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            אחרי שחיברתם את הטלפון של העובד, שלחו לו את הקישור הזה כדי שיתקין
            את האפליקציה במסך הבית ויחתים ממנה כניסה ויציאה.
          </p>
          <p
            dir="ltr"
            className="truncate rounded-md border bg-muted/40 p-2 text-start text-xs text-muted-foreground"
          >
            {installUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(installUrl);
                toast.success("הקישור הועתק");
              }}
            >
              <Copy className="size-4" />
              העתקת הקישור
            </Button>
            {/* No number in the wa.me link, so WhatsApp opens its own
                contact picker and the owner chooses the worker there. */}
            <Button variant="success" size="sm" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `שלום, זו אפליקציית הנוכחות של מקום העבודה.\nפתחו את הקישור והתקינו אותה בטלפון:\n${installUrl}`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-4" />
                שליחה בוואטסאפ
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4" />
            מיקום מקום העבודה
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            עמדו במקום העבודה ולחצו על הכפתור — המיקום הנוכחי שלכם יהפוך
            למרכז האזור שממנו מותר להחתים.
          </p>
          <Button
            variant="outline"
            className="w-fit"
            disabled={pending}
            onClick={useMyLocation}
          >
            <Crosshair className="size-4" />
            שימוש במיקום הנוכחי שלי
          </Button>

          {hasLocation && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">קו רוחב</div>
                  <div dir="ltr" className="text-end font-medium tabular-nums">
                    {lat!.toFixed(6)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">קו אורך</div>
                  <div dir="ltr" className="text-end font-medium tabular-nums">
                    {lng!.toFixed(6)}
                  </div>
                </div>
                {fix && (
                  <div>
                    <div className="text-muted-foreground">דיוק</div>
                    <div className="font-medium">±{Math.round(fix.accuracy)} מטר</div>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>רדיוס מותר</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {RADIUS_CHOICES.map((r) => (
                    <Button
                      key={r}
                      type="button"
                      size="sm"
                      variant={radius === r ? "default" : "outline"}
                      onClick={() => setRadius(r)}
                    >
                      {r} מ׳
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min={20}
                    max={5000}
                    dir="ltr"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="h-9 w-24"
                    aria-label="רדיוס מותר במטרים"
                  />
                </div>
              </div>

              <GeofenceMap latitude={lat!} longitude={lng!} radiusM={radius} />

              <Button
                className="w-fit"
                disabled={pending}
                onClick={onSaveLocation}
              >
                שמירת המיקום
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="size-4" />
            רשת מקום העבודה
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            התחברו ל־Wi-Fi של מקום העבודה ולחצו על הכפתור. אין צורך להזין שם
            רשת או סיסמה — המערכת מזהה את הרשת בעצמה.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={ipRegistered ? "outline" : "default"}
              disabled={pending}
              onClick={onRegisterNetwork}
            >
              <Wifi className="size-4" />
              {ipRegistered ? "הרשת הזו כבר רשומה" : "רישום הרשת הנוכחית"}
            </Button>
            {ipRegistered && <Badge variant="success">אתם ברשת רשומה</Badge>}
          </div>

          {settings.allowedIps.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">
                רשתות רשומות
              </Label>
              {settings.allowedIps.map((ip) => (
                <div
                  key={ip}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Wifi className="size-4 text-muted-foreground" aria-hidden />
                    {ip === currentIp ? "הרשת הנוכחית" : "רשת רשומה"}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="הסרת רשת"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => onRemoveNetwork(ip)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
