"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MapStop = {
  order_id: string;
  customer_name: string;
  delivery_code: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  amount_to_collect: number;
  address_text: string | null;
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/**
 * Full-screen deliveries map (OpenStreetMap tiles via Leaflet — free, no
 * key). Plots every stop that has coordinates; each popup has the details
 * and a "navigate" link that hands the exact point to the phone's maps app.
 */
export function DeliveriesMap({
  stops,
  onClose,
}: {
  stops: MapStop[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const withCoords = stops.filter(
    (s) => s.latitude != null && s.longitude != null
  );

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;

      map = L.map(ref.current).setView([31.4, 34.9], 8); // Israel
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const markers: import("leaflet").Marker[] = [];
      for (const s of withCoords) {
        const done = s.status !== "pending";
        const color = done ? "#16a34a" : "#f59e0b";
        const label = s.delivery_code ?? "";
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#fff;font-weight:700;font-size:12px;
            width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;
            align-items:center;justify-content:center">
            <span style="transform:rotate(45deg)">${esc(label)}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 28],
          popupAnchor: [0, -28],
        });
        const m = L.marker([s.latitude as number, s.longitude as number], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:150px;text-align:right" dir="rtl">
              <b>${esc(s.customer_name)}</b>${label ? ` · ${esc(label)}` : ""}<br>
              ${s.address_text ? esc(s.address_text) + "<br>" : ""}
              ${s.amount_to_collect > 0 ? `לגבייה: ₪${s.amount_to_collect}<br>` : ""}
              <a href="https://waze.com/ul?ll=${s.latitude},${s.longitude}&navigate=yes"
                 target="_blank" rel="noreferrer">ניווט ←</a>
            </div>`
          );
        markers.push(m);
      }

      if (markers.length) {
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
      }
      // Leaflet needs a size recalculation once the container is visible.
      setTimeout(() => map?.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [withCoords]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <h2 className="text-lg font-bold">מפת משלוחים</h2>
          <p className="text-xs text-muted-foreground">
            {withCoords.length} מתוך {stops.length} עם מיקום
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="סגירה">
          <X className="size-6" />
        </Button>
      </div>
      <div ref={ref} className="flex-1" />
      {withCoords.length === 0 && (
        <p className="absolute inset-x-0 top-1/2 text-center text-muted-foreground">
          אין משלוחים עם מיקום שמור. הוסיפו כתובת ללקוח כדי לראות על המפה.
        </p>
      )}
    </div>
  );
}
