// Singapore center coordinates
export const SINGAPORE_LAT_LNG: LatLngTuple = [1.3521, 103.8198];
export const DEFAULT_ZOOM = 16;

import {
  MapContainer,
  TileLayer,
  Popup,
  useMapEvents,
  Marker,
  CircleMarker,
} from "react-leaflet";
import L, { LatLngTuple, Map as LeafLetMap } from "leaflet";

// Fix for default Leaflet icon paths in React production builds

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import React from "react";

delete L.Icon.Default.prototype._getIconUrl;

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

export type MapPoint = {
  position: LatLngTuple;
  content?: string;
  colorHex?: string;
};

type MapProps = {
  initialCenter?: LatLngTuple;
  points?: MapPoint[];
  onClick?: (coordinates: LatLngTuple) => void;
  heightPx?: number;
  initialZoom?: number;
};

export const Map = React.forwardRef<LeafLetMap, MapProps>(
  (
    {
      initialCenter = SINGAPORE_LAT_LNG,
      initialZoom = DEFAULT_ZOOM,
      points = [],
      heightPx = 200,
      onClick,
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

          {/* Conditionally renders a map marker at user-clicked location */}
          {points &&
            points.map((point) => (
              <CircleMarker
                radius={8}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: point.colorHex ?? "#16a34a", // Circle fill color
                  fillOpacity: 1,
                  weight: 2.3, // Border width
                }}
                key={point.toString()}
                center={point.position}
              >
                <Popup content={point.content} />
              </CircleMarker>
            ))}
        </MapContainer>
      </div>
    );
  },
);

Map.displayName = "OneMap";

export default Map;
