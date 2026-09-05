"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export type AddressValue = {
  address_text: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
  };
};

/**
 * Address field backed by OpenStreetMap Nominatim (free, no API key).
 * As you type it suggests Israeli addresses; picking one captures the
 * address, city, and lat/lng for the deliveries map. Free-typed text is
 * still kept (minus coordinates). Debounced to respect Nominatim usage.
 */
export function AddressAutocomplete({
  defaultValue,
  onChange,
  id,
  placeholder,
}: {
  defaultValue?: string;
  onChange: (value: AddressValue) => void;
  id?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(defaultValue ?? "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function search(q: string) {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2" +
          "&countrycodes=il&addressdetails=1&limit=6&accept-language=he&q=" +
          encodeURIComponent(q);
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = (await res.json()) as NominatimResult[];
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 500);
  }

  function pick(r: NominatimResult) {
    const a = r.address ?? {};
    const city =
      a.city || a.town || a.village || a.municipality || a.suburb || null;
    setText(r.display_name);
    setResults([]);
    setOpen(false);
    onChangeRef.current({
      address_text: r.display_name,
      city,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    });
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          onChangeRef.current({
            address_text: v,
            city: null,
            latitude: null,
            longitude: null,
          });
          search(v);
        }}
        onFocus={() => {
          if (results.length) setOpen(true);
        }}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="block w-full px-3 py-2 text-start text-sm hover:bg-muted"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
