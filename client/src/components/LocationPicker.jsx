/**
 * LocationPicker — Google Maps + Places Autocomplete for café location selection.
 *
 * Props:
 *   value: { lat, lng, address } | null
 *   onChange: ({ lat, lng, address }) => void
 *   disabled?: boolean
 *
 * Uses PlaceAutocompleteElement (new Places API) — NOT the legacy Autocomplete class.
 * Uses AdvancedMarkerElement (new Marker API) — NOT the legacy google.maps.Marker.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from './GoogleMapsLoader';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

/** Create an SVG DOM element for custom marker pins */
function createPinSvg(color, strokeColor, size = 32) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${strokeColor}" stroke-width="0.5"/>`;
  return svg;
}

export default function LocationPicker({ value, onChange, disabled }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const markerLibRef = useRef(null);
  const acContainerRef = useRef(null);
  const acMountedRef = useRef(false);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(!MAPS_API_KEY ? 'no-key' : null);
  const [manualAddr, setManualAddr] = useState(value?.address || '');

  // Stable onChange ref to avoid re-mount loops
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Load Maps API
  useEffect(() => {
    if (!MAPS_API_KEY) return;
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => setMapsError('load-failed'));
  }, []);

  // Default centre: India
  const defaultCenter = { lat: 22.9734, lng: 78.6569 };
  const center = value?.lat ? { lat: value.lat, lng: value.lng } : defaultCenter;

  const updateMarker = useCallback(async (map, lat, lng, address) => {
    const maps = window.google.maps;
    // Remove old marker
    if (markerRef.current) markerRef.current.map = null;

    // Load marker library if not cached
    if (!markerLibRef.current) {
      markerLibRef.current = await maps.importLibrary('marker');
    }
    const { AdvancedMarkerElement } = markerLibRef.current;

    const marker = new AdvancedMarkerElement({
      position: { lat, lng },
      map,
      gmpDraggable: !disabled,
      title: 'Café Location',
      content: createPinSvg('#f97316', '#ea580c', 36),
    });
    markerRef.current = marker;

    marker.addEventListener('gmp-dragend', () => {
      const pos = marker.position;
      if (!pos) return;
      const newLat = pos.lat;
      const newLng = pos.lng;
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        const addr = status === 'OK' && results[0] ? results[0].formatted_address : `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;
        setManualAddr(addr);
        onChangeRef.current({ lat: newLat, lng: newLng, address: addr });
      });
    });

    onChangeRef.current({ lat, lng, address: address || manualAddr });
  }, [disabled, manualAddr]);

  // Initialise map
  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;
    const maps = window.google.maps;
    const map = new maps.Map(mapRef.current, {
      center,
      zoom: value?.lat ? 15 : 5,
      mapId: MAPS_MAP_ID,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    // Place marker if value exists
    if (value?.lat) {
      updateMarker(map, value.lat, value.lng, value.address);
    }

    // Click to place marker
    map.addListener('click', (e) => {
      if (disabled) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      const geocoder = new maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const addr = status === 'OK' && results[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setManualAddr(addr);
        updateMarker(map, lat, lng, addr);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  // Mount PlaceAutocompleteElement (New Places API)
  useEffect(() => {
    if (!mapsReady || !acContainerRef.current || acMountedRef.current) return;
    acMountedRef.current = true;

    (async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');

        const acElement = new PlaceAutocompleteElement();
        acElement.id = 'location-picker-autocomplete';
        acElement.style.cssText = 'width:100%;';

        // Clear container and mount
        acContainerRef.current.innerHTML = '';
        acContainerRef.current.appendChild(acElement);

        acElement.addEventListener('gmp-select', async (event) => {
          const placePrediction = event.placePrediction;
          if (!placePrediction) return;
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

          const loc = place.location;
          if (!loc) return;
          const lat = loc.lat();
          const lng = loc.lng();
          const addr = place.formattedAddress || place.displayName || '';
          setManualAddr(addr);

          const map = mapInstanceRef.current;
          if (map) {
            map.setCenter({ lat, lng });
            map.setZoom(16);
            updateMarker(map, lat, lng, addr);
          } else {
            onChangeRef.current({ lat, lng, address: addr });
          }
        });
      } catch (err) {
        console.warn('PlaceAutocompleteElement failed to load:', err);
      }
    })();
  }, [mapsReady, updateMarker]);

  // Fallback: manual address only (no key or load failure)
  if (mapsError === 'no-key' || mapsError === 'load-failed') {
    return (
      <div className="form-group">
        <label className="form-label" htmlFor="loc-addr-manual">
          Address
          {mapsError === 'no-key' && (
            <span className="form-optional" style={{ marginLeft: 8 }}>(Map unavailable — no API key)</span>
          )}
        </label>
        <input
          id="loc-addr-manual"
          className="form-input"
          type="text"
          placeholder="Full café address"
          value={manualAddr}
          disabled={disabled}
          onChange={(e) => {
            setManualAddr(e.target.value);
            onChangeRef.current({ lat: value?.lat || null, lng: value?.lng || null, address: e.target.value });
          }}
        />
      </div>
    );
  }

  return (
    <div className="location-picker">
      <label className="form-label">📍 Café Location</label>

      {/* PlaceAutocompleteElement mounts here */}
      <div
        ref={acContainerRef}
        className="location-picker-ac-container"
        style={{ marginBottom: 'var(--space-3)' }}
      >
        {/* Placeholder before the web component loads */}
        {!mapsReady && (
          <input className="form-input" type="text" placeholder="Loading maps…" disabled />
        )}
      </div>

      {/* Map canvas */}
      <div
        ref={mapRef}
        className="location-picker-map"
        style={{ height: 280, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)' }}
      />

      {/* Coordinates display */}
      {value?.lat && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          📌 {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          {manualAddr && <span style={{ marginLeft: 'var(--space-2)' }}>— {manualAddr}</span>}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'var(--space-3)', padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
            onClick={() => {
              if (markerRef.current) markerRef.current.map = null;
              markerRef.current = null;
              setManualAddr('');
              onChangeRef.current({ lat: null, lng: null, address: '' });
            }}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
