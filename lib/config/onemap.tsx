// Singapore center coordinates
export const SINGAPORE_LAT_LNG: LatLngTuple = [1.3521, 103.8198];
export const DEFAULT_ZOOM = 16;

import {
  MapContainer,
  TileLayer,
  Popup,
  useMap,
  useMapEvents,
  CircleMarker,
  Marker,
} from "react-leaflet";
import L, { LatLngTuple, Map as LeafLetMap, DivIcon } from "leaflet";

// Fix for default Leaflet icon paths in React production builds

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import React, { useEffect, useRef } from "react";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Child component specifically tasked with managing map user clicks
function ClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    },
  });
  return null;
}

// MapContainer only renders children once the map instance exists, so this
// child mounting signals the forwarded ref is populated and safe to control.
// Fires once per mount; the callback is mirrored into a ref so consumers may
// pass an inline closure without retriggering this effect.
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const map = useMap();
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    onReadyRef.current?.();
  }, [map]);

  return null;
}

export type MapPoint = {
  position: LatLngTuple;
  content?: string;
  colorHex?: string;
  /** Text rendered inside a cluster-style badge, e.g. a report count */
  count?: number;
  /** "square" renders the not-sighted marker style instead of a round dot */
  shape?: "circle" | "square";
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const CLUSTER_SIZE_PX = 26;
const POINT_SIZE_PX = 16;

function buildStyledIcon(point: MapPoint): DivIcon | null {
  const isCluster = typeof point.count === "number" && point.count > 1;
  const isSquare = point.shape === "square";
  if (!isCluster && !isSquare) return null;

  const size = isCluster ? CLUSTER_SIZE_PX : POINT_SIZE_PX;
  const backgroundColor = isCluster
    ? "#16a34a"
    : (point.colorHex ?? "#f59e0b");
  const borderColor =
    isCluster ? "#ffffff" : "#7c2d12";
  const borderRadius = isSquare ? "4px" : "999px";
  const boxShadow = isCluster
    ? "0 4px 12px rgba(15, 23, 42, 0.28)"
    : "0 2px 8px rgba(15, 23, 42, 0.25)";
  const fontSize = isCluster ? (point.count! >= 10 ? "10px" : "11px") : "14px";
  const text = isCluster ? String(point.count) : "-";

  return L.divIcon({
    className: "onemap-point-icon",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;font-family:system-ui,sans-serif;background-color:${backgroundColor};border:2px solid ${borderColor};border-radius:${borderRadius};box-shadow:${boxShadow};color:#ffffff;font-size:${fontSize};font-weight:700;line-height:1;">${escapeHtml(text)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function MapPointMarker({ point }: { point: MapPoint }) {
  const icon = buildStyledIcon(point);

  if (!icon) {
    return (
      <CircleMarker
        radius={8}
        pathOptions={{
          color: "#ffffff",
          fillColor: point.colorHex ?? "#16a34a",
          fillOpacity: 1,
          weight: 2.3,
        }}
        center={point.position}
      >
        {/* Raw HTML string — Leaflet sets innerHTML from the content option */}
        <Popup content={point.content} />
      </CircleMarker>
    );
  }

  return (
    <Marker position={point.position} icon={icon}>
      {/* Raw HTML string — Leaflet sets innerHTML from the content option */}
      <Popup content={point.content} />
    </Marker>
  );
}

type MapProps = {
  initialCenter?: LatLngTuple;
  points?: MapPoint[];
  onClick?: (coordinates: LatLngTuple) => void;
  heightPx?: number;
  initialZoom?: number;
  /** Called once the underlying Leaflet map instance is ready for control */
  onReady?: () => void;
};

export const Map = React.forwardRef<LeafLetMap, MapProps>(
  (
    {
      initialCenter = SINGAPORE_LAT_LNG,
      initialZoom = DEFAULT_ZOOM,
      points = [],
      heightPx = 200,
      onClick,
      onReady,
    },
    ref,
  ) => {
    const handleMapClick = (lat: number, lng: number) => {
      // Pro-Tip: You can call your state updates or backend API requests right here
      if (onClick) {
        onClick([lat, lng]);
      }
    };

    return (
      <div
        style={{
          height: heightPx,
          width: "100%",
          borderRadius: 15,
          overflow: "clip",
          // Own stacking context so Leaflet's high internal pane z-indexes
          // don't overlay modals/toasts rendered outside the map.
          position: "relative",
          zIndex: 0,
        }}
      >
        <MapContainer
          ref={ref}
          center={initialCenter}
          zoom={initialZoom}
          style={{ height: "100%", width: "100%" }}
          maxZoom={19}
          minZoom={11}
        >
          {/* Official OneMap Tile Server API Endpoint */}
          <TileLayer
            url="https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png"
            detectRetina
            maxZoom={19}
            minZoom={11}
            /** DO NOT REMOVE the OneMap attribution below **/
            attribution={
              '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/>&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'
            }
          />

          {/* Attaches click functionality onto the active instance */}
          <ClickHandler onMapClick={handleMapClick} />

          <ReadySignal onReady={onReady} />

          {/* Renders one styled marker per point */}
          {points.map((point, index) => (
            <MapPointMarker
              key={`${point.position[0]},${point.position[1]}-${index}`}
              point={point}
            />
          ))}
        </MapContainer>
      </div>
    );
  },
);

Map.displayName = "OneMap";

export default Map;
