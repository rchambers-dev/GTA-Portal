import L from "leaflet";
import {
  uiState,
} from "../../app/ui-state.js";
import { escapeHtml } from "../../lib/html.js";
import {
  formatTime,
} from "../../planner.js";
import {
  drivingGeometry,
} from "../../geo.js";
import {
  displayPlanDay,
} from "./calendar.js";

export function setMapPanelOpen(open) {
  const panel = document.getElementById("map-panel");
  const toggle = document.getElementById("map-toggle");
  if (!panel || !toggle) return;
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.textContent = open ? "Hide map" : "Show map";
  if (!open || !uiState.map) return;
  uiState.map.invalidateSize();
  const day = displayPlanDay(uiState.selectedDateKey);
  if (uiState.planResult && day && !day.lookback && day.stops?.length) drawMap(day);
  else drawMap({ stops: [] });
}

const MAP_HOME = [53.53, -1.07];
const MAP_ZOOM = 11;

export function initMap() {
  uiState.map = L.map("map", { scrollWheelZoom: true, zoomControl: false }).setView(MAP_HOME, MAP_ZOOM);
  L.control.zoom({ zoomInTitle: "", zoomOutTitle: "" }).addTo(uiState.map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(uiState.map);
  uiState.map.getContainer().querySelectorAll("[title]").forEach((el) => el.removeAttribute("title"));
}

function markerIcon(label, variant = "stop") {
  return L.divIcon({
    className: "pin",
    html: `<div class="map-pin is-${variant === "office" ? "office" : "stop"}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

let mapDrawId = 0;

export function cancelMapDraw() {
  mapDrawId += 1;
  if (uiState.map && uiState.mapLayer) uiState.map.removeLayer(uiState.mapLayer);
  uiState.mapLayer = null;
  if (uiState.map) uiState.map.setView(MAP_HOME, MAP_ZOOM);
}

export async function drawMap(day) {
  if (document.getElementById("map-panel")?.hidden) return;
  const drawId = ++mapDrawId;
  if (uiState.mapLayer && uiState.map) uiState.map.removeLayer(uiState.mapLayer);
  uiState.mapLayer = L.layerGroup().addTo(uiState.map);

  if (!uiState.planResult) return;

  const office = uiState.planResult.office;
  L.marker([office.lat, office.lon], { icon: markerIcon("O", "office") })
    .addTo(uiState.mapLayer)
    .bindPopup(`Office · ${escapeHtml(office.postcode)}`);

  if (!day?.stops.length) {
    uiState.map.setView([office.lat, office.lon], 11);
    setTimeout(() => {
      if (drawId === mapDrawId) uiState.map.invalidateSize();
    }, 50);
    return;
  }

  day.stops.forEach((stop, index) => {
    L.marker([stop.lat, stop.lon], { icon: markerIcon(String(index + 1)) })
      .addTo(uiState.mapLayer)
      .bindPopup(
        `${escapeHtml(stop.name)}<br>${escapeHtml(stop.postcode)}<br>${formatTime(stop.arrive)}–${formatTime(stop.leave)}`,
      );
  });

  const routePoints = [
    office,
    ...day.stops,
    office,
  ].map((point) => ({ lat: point.lat, lon: point.lon }));

  const geometry = await drivingGeometry(routePoints);
  if (drawId !== mapDrawId) return;
  if (geometry?.coordinates?.length) {
    const latLngs = geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const line = L.polyline(latLngs, { color: "#b44a2c", weight: 4 }).addTo(
      uiState.mapLayer,
    );
    uiState.map.fitBounds(line.getBounds(), { padding: [24, 24] });
  } else {
    const latLngs = routePoints.map((point) => [point.lat, point.lon]);
    const line = L.polyline(latLngs, {
      color: "#b44a2c",
      weight: 4,
      dashArray: "6 8",
    }).addTo(uiState.mapLayer);
    uiState.map.fitBounds(line.getBounds(), { padding: [24, 24] });
  }

  setTimeout(() => {
    if (drawId === mapDrawId) uiState.map.invalidateSize();
  }, 50);
}
