'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE } from '@/lib/config/mapbox'
import { MapPin } from 'lucide-react'

interface LocationPickerProps {
  lat?: number | null
  lng?: number | null
  onLocationChange: (lat: number, lng: number) => void
  className?: string
}

export function LocationPicker({
  lat,
  lng,
  onLocationChange,
  className = 'w-full h-48 rounded-xl overflow-hidden',
}: LocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Track online/offline to re-attempt map init on reconnect
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const initializeMap = () => {
    if (!MAPBOX_TOKEN || !mapContainer.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    // Determine initial center: props > geolocation > default
    const initialCenter: [number, number] = lat && lng ? [lng, lat] : DEFAULT_CENTER
    const initialZoom = lat && lng ? 15 : 12

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: initialCenter,
      zoom: initialZoom,
    })

    mapRef.current = map

    const marker = new mapboxgl.Marker({ draggable: true, color: '#16a34a' })
      .setLngLat(initialCenter)
      .addTo(map)

    markerRef.current = marker

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat()
      onLocationChange(lngLat.lat, lngLat.lng)
    })

    map.on('click', (e) => {
      marker.setLngLat(e.lngLat)
      onLocationChange(e.lngLat.lat, e.lngLat.lng)
    })

    map.on('load', () => {
      setLoaded(true)
    })

    // Auto-center on user geolocation if no lat/lng props set
    if (!lat && !lng && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLng = position.coords.longitude
          const userLat = position.coords.latitude
          map.flyTo({ center: [userLng, userLat], zoom: 15 })
          marker.setLngLat([userLng, userLat])
        },
        () => {
          // Geolocation denied/unavailable — stay at DEFAULT_CENTER
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      )
    }
  }

  // Init on mount
  useEffect(() => {
    initializeMap()
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Retry init when coming online if map wasn't loaded (e.g. mounted while offline)
  useEffect(() => {
    if (online && !loaded) {
      initializeMap()
    }
  }, [online, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded && markerRef.current && lat && lng) {
      markerRef.current.setLngLat([lng, lat])
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 })
    }
  }, [lat, lng, loaded])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`${className} bg-gray-100 flex flex-col items-center justify-center gap-2`}>
        <MapPin className="w-6 h-6 text-gray-300" />
        <p className="text-xs text-gray-400">Map requires NEXT_PUBLIC_MAPBOX_TOKEN</p>
      </div>
    )
  }

  if (!loaded && !online) {
    return (
      <div className={`${className} bg-gray-100 flex flex-col items-center justify-center gap-2`}>
        <MapPin className="w-6 h-6 text-gray-300" />
        <p className="text-xs text-gray-400">Map unavailable offline</p>
        {lat && lng && (
          <p className="text-xs text-gray-500">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
        )}
      </div>
    )
  }

  return <div ref={mapContainer} className={className} />
}
