"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * The work site and the circle around it that a phone must be inside.
 *
 * Leaflet is imported lazily, exactly as the driver map does — it touches
 * `window` on load and would break server rendering otherwise.
 */
export function GeofenceMap({
  latitude,
  longitude,
  radiusM,
}: {
  latitude: number;
  longitude: number;
  radiusM: number;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !holder.current) return;

      map = L.map(holder.current, {
        center: [latitude, longitude],
        zoom: 17,
        attributionControl: false,
        zoomControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const circle = L.circle([latitude, longitude], {
        radius: radiusM,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
      L.circleMarker([latitude, longitude], {
        radius: 6,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);

      map.fitBounds(circle.getBounds(), { padding: [24, 24] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [latitude, longitude, radiusM]);

  return (
    <div
      ref={holder}
      className="h-64 w-full rounded-lg border"
      role="img"
      aria-label="מפת מקום העבודה והרדיוס המותר"
    />
  );
}
