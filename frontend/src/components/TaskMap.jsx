// ──────────────────────────────────────────────────────────────
// TaskMap – Interactive map showing task markers using Leaflet
// Uses OpenStreetMap tiles (free, no API key needed)
// Supports: light tiles, boundary circle, admin click-to-place
// ──────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLORS = {
  'not-started': '#6b7280',  // gray
  'in-progress': '#00f0ff',  // neon cyan
  completed: '#39ff14',      // neon green
};

function createMarkerSvg(number, color) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${color}" flood-opacity="0.5"/>
        </filter>
      </defs>
      <path d="M18 46s-18-20-18-28a18 18 0 0136 0c0 8-18 28-18 28z" fill="${color}" filter="url(#shadow)" opacity="0.9"/>
      <circle cx="18" cy="18" r="12" fill="#0a0a0f"/>
      <text x="18" y="23" text-anchor="middle" fill="${color}" font-size="14" font-weight="bold" font-family="Inter, sans-serif">${number}</text>
    </svg>
  `;
}

/**
 * @param {Object} props
 * @param {Array}  props.tasks       - Tasks to display
 * @param {Object} props.config      - GameConfig object
 * @param {Function} props.onTaskClick - Callback(taskId) when popup button clicked
 * @param {Function} props.onMapClick  - Callback({lat,lng}) when map clicked (admin only)
 * @param {boolean}  props.adminMode   - If true, shows all markers and enables click-to-place
 */
export default function TaskMap({ tasks = [], config, onTaskClick, onMapClick, adminMode = false }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);
  const initialFitDoneRef = useRef(false);

  // Keep a ref to the latest onMapClick so the Leaflet click handler
  // (set up once in initMap) always calls the current callback
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    // Leaflet is imported from npm, initialize map now (guard for SSR)
    if (typeof window !== 'undefined') {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when tasks change
  useEffect(() => {
    if (mapInstanceRef.current && window.L) {
      updateMarkers();
    }
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update boundary circle when config changes
  useEffect(() => {
    if (mapInstanceRef.current && window.L && config) {
      updateBoundaryCircle();
    }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    const centerLat = config?.mapCenterLat || 52.2297;
    const centerLng = config?.mapCenterLng || 21.0122;
    const zoom = config?.mapZoom || 17;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Light map tiles (CartoDB Positron – clean white style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Attribution (small, bottom left)
    L.control.attribution({ position: 'bottomleft', prefix: false })
      .addAttribution('&copy; <a href="https://carto.com/">CARTO</a>')
      .addTo(map);

    // Admin click-to-place handler (uses ref so it always calls latest callback)
    if (adminMode) {
      map.on('click', (e) => {
        if (onMapClickRef.current) {
          onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
    }

    // Ensure a safe global hook for older popup HTML that may call it.
    // This keeps backwards compatibility and prevents runtime ReferenceErrors.
    if (typeof window !== 'undefined' && !window.__taskMapClick__) {
      // eslint-disable-next-line no-underscore-dangle
      window.__taskMapClick__ = (id) => {
        try {
          if (onTaskClick) onTaskClick(id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('window.__taskMapClick__ handler threw', err);
        }
      };
    }

    mapInstanceRef.current = map;
    updateMarkers();
    updateBoundaryCircle();
  }

  function updateBoundaryCircle() {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map || !config) return;

    // Remove existing circle
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
      circleRef.current = null;
    }

    // Draw boundary circle if radius is configured
    const radius = config.boundaryRadiusMeters;
    if (radius && radius > 0) {
      const centerLat = config.mapCenterLat || 52.2297;
      const centerLng = config.mapCenterLng || 21.0122;
      circleRef.current = L.circle([centerLat, centerLng], {
        radius,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.08,
        weight: 3,
        dashArray: '10 6',
        opacity: 0.6,
      }).addTo(map);
    }
  }

  function updateMarkers() {
    try {
      const L = window.L;
      const map = mapInstanceRef.current;
      if (!L || !map) return;

      // Clear existing markers
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

    const tasksWithCoords = tasks.filter((t) => {
      const lat = parseFloat(t.lat);
      const lng = parseFloat(t.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });

    tasksWithCoords.forEach((task) => {
      try {
        const lat = parseFloat(task.lat);
        const lng = parseFloat(task.lng);
        const color = STATUS_COLORS[task.status] || STATUS_COLORS['not-started'];
        const number = task.queuePosition || task.order || '?';

        const icon = L.divIcon({
          html: createMarkerSvg(number, color),
          className: 'task-marker',
          iconSize: [36, 46],
          iconAnchor: [18, 46],
          popupAnchor: [0, -46],
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(map);

        // Popup content – admin sees simple info (no "start task"), teams see action button
        const popupContent = adminMode
          ? `
            <div style="font-family: Inter, sans-serif; color: #1a1a2e; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <div style="font-size: 11px; color: ${color}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                Task #${number}
              </div>
              <div style="font-size: 14px; font-weight: 800; margin-bottom: 4px; color: #111;">${task.title}</div>
              <div style="font-size: 11px; color: #6b7280;">${task.locationHint || ''}</div>
              <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</div>
            </div>
          `
          : `
            <div style="font-family: Inter, sans-serif; color: #1a1a2e; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <div style="font-size: 11px; color: ${color}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                Task #${number}
              </div>
              <div style="font-size: 14px; font-weight: 800; margin-bottom: 6px; color: #111;">${task.title}</div>
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">${task.locationHint || ''}</div>
              <button class="task-popup-btn" data-task-id="${task._id}" 
                style="width: 100%; padding: 8px; border-radius: 8px; border: none; background: ${color}; color: #0a0a0f; font-weight: 700; font-size: 12px; cursor: pointer;">
                ${task.status === 'completed' ? 'View Details' : task.status === 'in-progress' ? 'Continue' : 'Go to Task'}
              </button>
            </div>
          `;

        marker.bindPopup(popupContent, {
          closeButton: false,
          className: 'task-popup',
          maxWidth: 220,
        });

        // Attach click handler when popup opens so we can call the React-provided onTaskClick
        marker.on('popupopen', (e) => {
          try {
            const popupEl = e.popup?.getElement();
            if (!popupEl) return;
            const btn = popupEl.querySelector('.task-popup-btn');
            if (!btn) return;
            const id = btn.getAttribute('data-task-id');
            btn.onclick = () => {
              try {
                if (onTaskClick) onTaskClick(id);
              } catch (err) {
                // swallow errors from user callback to avoid breaking the map UI
                // but surface to console for debugging
                // eslint-disable-next-line no-console
                console.error('onTaskClick handler threw:', err);
              }
            };
          } catch (err) {
            // defensive: ensure popup DOM interactions don't throw up to React
            // eslint-disable-next-line no-console
            console.error('Failed to attach popup button handler', err);
          }
        });

        markersRef.current.push(marker);
      } catch (err) {
        // swallow per-marker errors so one bad task doesn't break the whole map
        // eslint-disable-next-line no-console
        console.error('Failed to create marker for task', task?._id, err);
      }
    });

    // Fit bounds only on initial load (not when a single marker moves)
    if (!initialFitDoneRef.current && tasksWithCoords.length > 0) {
      initialFitDoneRef.current = true;
      try {
        if (tasksWithCoords.length > 1) {
          const bounds = L.latLngBounds(
            tasksWithCoords.map((t) => [parseFloat(t.lat), parseFloat(t.lng)])
          );
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
          }
        } else {
          map.setView([parseFloat(tasksWithCoords[0].lat), parseFloat(tasksWithCoords[0].lng)], 17);
        }
      } catch (e) {
        // Leaflet bounds error – ignore silently
      }
    }
  } catch (err) {
      // Top-level marker update failure should not crash the app
      // eslint-disable-next-line no-console
      console.error('updateMarkers failed', err);
    }

  }

  // ...popup handlers are attached when popups open

  return (
    <>
      <style>{`
        .task-marker { background: none !important; border: none !important; }
        .task-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .task-popup .leaflet-popup-content { margin: 0 !important; }
        .task-popup .leaflet-popup-tip { display: none !important; }
        /* Constrain Leaflet z-index to stay below BottomNav (z-50) */
        .leaflet-pane { z-index: auto !important; }
        .leaflet-zoom-control { z-index: 20 !important; }
        .leaflet-popup { z-index: 15 !important; }
      `}</style>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[400px] rounded-none"
        style={{ background: '#f8f9fa', zIndex: 10 }}
      />
    </>
  );
}
