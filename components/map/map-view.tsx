"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { getSpeciesDisplayName } from "@/lib/constants/species";
import OneMap, { MapPoint, SINGAPORE_LAT_LNG } from "@/lib/config/onemap";
import { latLngBounds, LatLngTuple, Map as LeafletMap } from "leaflet";

export interface MapMarker {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  popupHtml?: string;
  popupMeta?: string[];
  variant?: "sighted" | "not_sighted";
  species?: string;
  speciesOther?: string | null;
}

interface MapViewProps {
  center?: LatLngTuple;
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPopupHtml(marker: MapMarker) {
  const speciesName = getSpeciesDisplayName(
    marker.species,
    marker.speciesOther,
  );
  const title = escapeHtml(
    marker.variant === "not_sighted"
      ? "Not Sighted"
      : speciesName || marker.label || "Sighted",
  );
  const outcome = marker.variant === "not_sighted" ? "Not Sighted" : "Sighted";
  const outcomeBg = marker.variant === "not_sighted" ? "#fff7ed" : "#ecfdf5";
  const outcomeColor = marker.variant === "not_sighted" ? "#c2410c" : "#047857";
  const metaRows = (marker.popupMeta ?? [])
    .filter(Boolean)
    .map(
      (item) =>
        `<div style="font-size:12px;color:#475569;line-height:1.4;">${escapeHtml(item)}</div>`,
    )
    .join("");
  const coordinates = `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;

  return `
    <div style="min-width:180px;max-width:240px;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${title}</div>
        <span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;background:${outcomeBg};color:${outcomeColor};font-size:11px;font-weight:700;">
          ${outcome}
        </span>
      </div>
      <div style="display:grid;gap:4px;">
        ${metaRows}
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.4;">
        ${escapeHtml(coordinates)}
      </div>
    </div>
  `.trim();
}

function renderClusterPopupHtml(markers: MapMarker[]) {
  const sightedCount = markers.filter(
    (marker) => marker.variant !== "not_sighted",
  ).length;
  const notSightedCount = markers.length - sightedCount;
  const items = markers
    .slice(0, 6)
    .map((marker) => {
      const tone = marker.variant === "not_sighted" ? "#c2410c" : "#047857";
      const outcome =
        marker.variant === "not_sighted" ? "Not Sighted" : "Sighted";
      const meta = (marker.popupMeta ?? [])
        .slice(0, 2)
        .map(escapeHtml)
        .join(" • ");
      return `
        <div style="padding:8px 0;border-top:1px solid #e2e8f0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
            <span style="font-size:11px;font-weight:700;color:${tone};text-transform:uppercase;">${outcome}</span>
            <span style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(marker.label || "Report")}</span>
          </div>
          ${meta ? `<div style="font-size:12px;color:#475569;line-height:1.4;">${meta}</div>` : ""}
        </div>
      `.trim();
    })
    .join("");

  const moreCount = markers.length - 6;

  return `
    <div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif;">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">${markers.length} reports at this point</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700;">Sighted: ${sightedCount}</span>
        <span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700;">Not Sighted: ${notSightedCount}</span>
      </div>
      <div>${items}</div>
      ${moreCount > 0 ? `<div style="padding-top:8px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">+${moreCount} more report${moreCount === 1 ? "" : "s"}</div>` : ""}
    </div>
  `.trim();
}

function buildMapPoints(markers: MapMarker[]): MapPoint[] {
  const groupedMarkers = new Map<string, MapMarker[]>();
  for (const marker of markers) {
    // Bucket nearby points together so real-world GPS jitter still clusters on the analytics map.
    const key = `${marker.lat.toFixed(4)}:${marker.lng.toFixed(4)}`;
    const group = groupedMarkers.get(key) ?? [];
    group.push(marker);
    groupedMarkers.set(key, group);
  }

  const displayedMarkers = Array.from(groupedMarkers.values()).map((group) => {
    if (group.length === 1) {
      return {
        ...group[0],
        count: 1,
        isCluster: false,
        popupHtml: renderPopupHtml(group[0]),
      };
    }

    const sightedCount = group.filter(
      (marker) => marker.variant !== "not_sighted",
    ).length;
    const notSightedCount = group.length - sightedCount;
    const label = `${group.length} reports here`;
    return {
      ...group[0],
      label,
      popupHtml: renderClusterPopupHtml(group),
      count: group.length,
      isCluster: true,
      variant:
        sightedCount > 0 && notSightedCount > 0 ? "sighted" : group[0].variant,
    };
  });

  return displayedMarkers.map((marker) => ({
    position: [marker.lat, marker.lng] as [number, number],
    content: marker.popupHtml,
    colorHex: marker.color,
    count:
      marker.isCluster && (marker.count ?? 1) > 1
        ? (marker.count as number)
        : undefined,
    shape: marker.variant === "not_sighted" ? ("square" as const) : undefined,
  }));
}

export function MapView({
  center = SINGAPORE_LAT_LNG,
  zoom = 11,
  markers = [],
  className = "w-full h-64 rounded-xl overflow-hidden",
  onMapClick,
}: MapViewProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  // Increments each time the Leaflet map mounts so camera effects re-run even
  // when marker data is unchanged.
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const oneMapMarkers = useMemo(() => buildMapPoints(markers), [markers]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markers.length === 1) {
      map.flyTo([markers[0].lat, markers[0].lng], Math.max(zoom, 13));
      return;
    }

    if (markers.length > 1) {
      map.fitBounds(
        latLngBounds(oneMapMarkers.map((m) => m.position)),
        { padding: [72, 72], maxZoom: 14 },
      );
    }
  }, [markers, zoom, oneMapMarkers, mapReadyTick]);

  if (!online) {
    return (
      <div
        className={`${className} bg-gray-100 flex items-center justify-center border border-gray-200`}
      >
        <p className="text-sm text-gray-400">Map unavailable offline</p>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div
        className={`${className} border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-2 px-4 text-center`}
      >
        <MapPin className="h-6 w-6 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">
          No coordinates to show yet
        </p>
        <p className="text-xs text-gray-400">
          Markers will appear here once sightings with GPS coordinates are
          available.
        </p>
      </div>
    );
  }

  return (
    <OneMap
      ref={mapRef}
      points={oneMapMarkers}
      heightPx={300}
      initialZoom={13.5}
      initialCenter={center}
      onClick={
        onMapClick
          ? (coordinates) => onMapClick(coordinates[0], coordinates[1])
          : undefined
      }
      onReady={() => setMapReadyTick((tick) => tick + 1)}
    />
  );
}
