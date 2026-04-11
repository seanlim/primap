'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from '@/lib/config/mapbox'
import { MapPin } from 'lucide-react'
import { getSpeciesDisplayName } from '@/lib/constants/species'

export interface MapMarker {
  lat: number
  lng: number
  color?: string
  label?: string
  popupHtml?: string
  popupMeta?: string[]
  variant?: 'sighted' | 'not_sighted'
  species?: string
  speciesOther?: string | null
}

interface MapViewProps {
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  className?: string
  onMapClick?: (lat: number, lng: number) => void
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderPopupHtml(marker: MapMarker) {
  const speciesName = getSpeciesDisplayName(marker.species, marker.speciesOther)
  const title = escapeHtml(
    marker.variant === 'not_sighted'
      ? 'Not Sighted'
      : speciesName || marker.label || 'Sighted'
  )
  const outcome = marker.variant === 'not_sighted' ? 'Not Sighted' : 'Sighted'
  const outcomeBg = marker.variant === 'not_sighted' ? '#fff7ed' : '#ecfdf5'
  const outcomeColor = marker.variant === 'not_sighted' ? '#c2410c' : '#047857'
  const metaRows = (marker.popupMeta ?? [])
    .filter(Boolean)
    .map((item) => `<div style="font-size:12px;color:#475569;line-height:1.4;">${escapeHtml(item)}</div>`)
    .join('')
  const coordinates = `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`

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
  `.trim()
}

function renderClusterPopupHtml(markers: MapMarker[]) {
  const sightedCount = markers.filter((marker) => marker.variant !== 'not_sighted').length
  const notSightedCount = markers.length - sightedCount
  const items = markers
    .slice(0, 6)
    .map((marker) => {
      const tone = marker.variant === 'not_sighted' ? '#c2410c' : '#047857'
      const outcome = marker.variant === 'not_sighted' ? 'Not Sighted' : 'Sighted'
      const meta = (marker.popupMeta ?? []).slice(0, 2).map(escapeHtml).join(' • ')
      return `
        <div style="padding:8px 0;border-top:1px solid #e2e8f0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
            <span style="font-size:11px;font-weight:700;color:${tone};text-transform:uppercase;">${outcome}</span>
            <span style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(marker.label || 'Report')}</span>
          </div>
          ${meta ? `<div style="font-size:12px;color:#475569;line-height:1.4;">${meta}</div>` : ''}
        </div>
      `.trim()
    })
    .join('')

  const moreCount = markers.length - 6

  return `
    <div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif;">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;">${markers.length} reports at this point</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700;">Sighted: ${sightedCount}</span>
        <span style="display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700;">Not Sighted: ${notSightedCount}</span>
      </div>
      <div>${items}</div>
      ${moreCount > 0 ? `<div style="padding-top:8px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">+${moreCount} more report${moreCount === 1 ? '' : 's'}</div>` : ''}
    </div>
  `.trim()
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
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [loaded, setLoaded] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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

    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng)
      })
    }

    map.on('load', () => {
      setLoaded(true)
    })

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
  }, [center, zoom, onMapClick])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const groupedMarkers = new Map<string, MapMarker[]>()
    for (const marker of markers) {
      // Bucket nearby points together so real-world GPS jitter still clusters on the analytics map.
      const key = `${marker.lat.toFixed(4)}:${marker.lng.toFixed(4)}`
      const group = groupedMarkers.get(key) ?? []
      group.push(marker)
      groupedMarkers.set(key, group)
    }

    const displayedMarkers = Array.from(groupedMarkers.values()).map((group) => {
      if (group.length === 1) {
        return {
          ...group[0],
          count: 1,
          isCluster: false,
          popupHtml: renderPopupHtml(group[0]),
        }
      }

      const sightedCount = group.filter((marker) => marker.variant !== 'not_sighted').length
      const notSightedCount = group.length - sightedCount
      const label = `${group.length} reports here`
      return {
        ...group[0],
        label,
        popupHtml: renderClusterPopupHtml(group),
        count: group.length,
        isCluster: true,
        variant: sightedCount > 0 && notSightedCount > 0
          ? 'sighted'
          : group[0].variant,
      }
    })

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = displayedMarkers.map((marker) => {
      const el = document.createElement('div')
      const markerCount = marker.count ?? 1
      const isCluster = marker.isCluster === true
      const isNotSighted = marker.variant === 'not_sighted'
      el.style.width = isCluster ? '26px' : '16px'
      el.style.height = isCluster ? '26px' : '16px'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.cursor = 'pointer'
      el.style.boxSizing = 'border-box'
      el.style.fontFamily = 'system-ui, sans-serif'

      if (isCluster) {
        el.style.backgroundColor = '#16a34a'
        el.style.border = '2px solid #ffffff'
        el.style.borderRadius = '999px'
        el.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.28)'
        el.style.color = '#ffffff'
        el.style.fontSize = markerCount >= 10 ? '10px' : '11px'
        el.style.fontWeight = '700'
        el.style.lineHeight = '1'
        el.textContent = String(markerCount)
      } else if (isNotSighted) {
        el.style.backgroundColor = marker.color || '#f59e0b'
        el.style.border = '2px solid #7c2d12'
        el.style.borderRadius = '4px'
        el.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.25)'
        el.style.color = '#ffffff'
        el.style.fontSize = '14px'
        el.style.fontWeight = '700'
        el.style.lineHeight = '1'
        el.textContent = '-'
      } else {
        el.style.backgroundColor = marker.color || '#16a34a'
        el.style.border = '2px solid #ffffff'
        el.style.borderRadius = '999px'
        el.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.25)'
      }

      el.title = marker.label || ''

      const mapMarker = new mapboxgl.Marker(el).setLngLat([marker.lng, marker.lat])

      if (marker.popupHtml) {
        mapMarker.setPopup(
          new mapboxgl.Popup({ offset: isCluster ? 16 : isNotSighted ? 10 : 14 }).setHTML(marker.popupHtml)
        )
      }

      return mapMarker.addTo(map)
    })

    if (markers.length === 0) {
      map.easeTo({ center, zoom, duration: 500 })
      return
    }

    if (markers.length === 1) {
      map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: Math.max(zoom, 13) })
      return
    }

    const bounds = new mapboxgl.LngLatBounds()
    displayedMarkers.forEach((marker) => bounds.extend([marker.lng, marker.lat]))
    map.fitBounds(bounds, { padding: 72, maxZoom: 14 })
  }, [center, zoom, markers, loaded])

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center border border-gray-200`}>
        <p className="text-sm text-gray-400">Map requires NEXT_PUBLIC_MAPBOX_TOKEN</p>
      </div>
    )
  }

  if (!loaded && !online) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center border border-gray-200`}>
        <p className="text-sm text-gray-400">Map unavailable offline</p>
      </div>
    )
  }

  if (markers.length === 0) {
    return (
      <div className={`${className} border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-2 px-4 text-center`}>
        <MapPin className="h-6 w-6 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">No coordinates to show yet</p>
        <p className="text-xs text-gray-400">Markers will appear here once sightings with GPS coordinates are available.</p>
      </div>
    )
  }

  return <div ref={mapContainer} className={className} />
}
