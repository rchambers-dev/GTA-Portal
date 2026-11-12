"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { PackedStop } from "../domain/plan-route";
import { drivingGeometry } from "../domain/geo";
import { minutesToTime } from "../domain/plan-due";

const MAP_HOME: [number, number] = [53.53, -1.07];

export function PlanMap({
  office,
  stops,
}: {
  office: { lat: number; lon: number; postcode: string } | null;
  stops: PackedStop[];
}) {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = node.current;
    if (!host) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !host) return;
      const view = L.map(host, { scrollWheelZoom: true, zoomControl: false }).setView(MAP_HOME, 11);
      map = view;
      L.control.zoom({ zoomInTitle: "", zoomOutTitle: "" }).addTo(view);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(view);
      const layer = L.layerGroup().addTo(view);
      if (!office) {
        view.invalidateSize();
        return;
      }
      L.marker([office.lat, office.lon], { icon: pin(L, "O", true) })
        .addTo(layer)
        .bindPopup(`Office · ${office.postcode}`);
      stops.forEach((stop, index) => {
        L.marker([stop.lat, stop.lon], { icon: pin(L, String(index + 1), false) })
          .addTo(layer)
          .bindPopup(`${stop.name}<br>${stop.postcode}<br>${minutesToTime(stop.arrive)}–${minutesToTime(stop.leave)}`);
      });
      const points = [office, ...stops, office];
      const geometry = await drivingGeometry(points);
      if (cancelled) return;
      const line = geometry?.coordinates?.length
        ? L.polyline(geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]), { color: "#b44a2c", weight: 4 })
        : L.polyline(points.map((point) => [point.lat, point.lon] as [number, number]), { color: "#b44a2c", weight: 4, dashArray: "6 8" });
      line.addTo(layer);
      view.fitBounds(line.getBounds(), { padding: [24, 24] });
      window.setTimeout(() => view.invalidateSize(), 50);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [office, stops]);

  return <div ref={node} className="plan-leaflet" />;
}

function pin(L: typeof import("leaflet"), label: string, office: boolean) {
  return L.divIcon({
    className: "plan-pin",
    html: `<div class="plan-pin-face${office ? " is-office" : ""}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
