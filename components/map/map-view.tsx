'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from '@/lib/config/mapbox'

interface MapViewProps {
  center?: [number, number]
  zoom?: number
  markers?: { lat: number; lng: number; color?: string; label?: string }[]
  className?: string
  onMapClick?: (lat: number, lng: number) => void
}

export function MapView({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = [],
  className = 'w-full h-64 rounded-xl overflow-hidden',
  onMapClick,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center,
      zoom,
    })

    mapRef.current = map

    // Add markers
    markers.forEach((m) => {
      const el = document.createElement('div')
      el.className = 'w-4 h-4 rounded-full border-2 border-white shadow-md'
      el.style.backgroundColor = m.color || '#16a34a'

      new mapboxgl.Marker(el).setLngLat([m.lng, m.lat]).addTo(map)
    })

    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng)
      })
    }

    if (markers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      markers.forEach((m) => bounds.extend([m.lng, m.lat]))
      map.fitBounds(bounds, { padding: 50 })
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [center, zoom, markers, onMapClick])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <p className="text-sm text-gray-400">Map requires NEXT_PUBLIC_MAPBOX_TOKEN</p>
      </div>
    )
  }

  return <div ref={mapContainer} className={className} />
}
