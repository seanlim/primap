"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import OneMap, { SINGAPORE_LAT_LNG } from "../../lib/config/onemap";
import { Map as LeafletMap } from "leaflet";

interface LocationPickerProps {
  lat?: number | null;
  lng?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

const PICKER_ZOOM = 18

export function LocationPicker({
  lat,
  lng,
  onLocationChange,
  className = "w-full h-48 rounded-xl overflow-hidden",
}: LocationPickerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const hasCoords = lat != null && lng != null;

  // Track online/offline to re-attempt map init on reconnect
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

  // Auto-center on user geolocation if no lat/lng props set
  useEffect(() => {
    if (!online || hasCoords || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        mapRef.current?.flyTo([userLat, userLng], PICKER_ZOOM);
        onLocationChange(userLat, userLng);
      },
      () => {
        // Geolocation denied/unavailable — stay at SINGAPORE_LAT_LNG
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, hasCoords]);

  useEffect(() => {
    if (hasCoords) {
      mapRef.current?.flyTo([lat, lng], PICKER_ZOOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (!online) {
    return (
      <div
        className={`${className} bg-gray-100 flex flex-col items-center justify-center gap-2`}
      >
        <MapPin className="w-6 h-6 text-gray-300" />
        <p className="text-xs text-gray-400">Map unavailable offline</p>
        {lat != null && lng != null && (
          <p className="text-xs text-gray-500">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        )}
      </div>
    );
  }

  return (
    <OneMap
      ref={mapRef}
      heightPx={192}
      initialCenter={hasCoords ? [lat, lng] : SINGAPORE_LAT_LNG}
      points={[
        { position: hasCoords ? [lat, lng] : SINGAPORE_LAT_LNG },
      ]}
      onClick={(coordinates) => {
        onLocationChange(coordinates[0], coordinates[1]);
      }}
    />
  );
}
