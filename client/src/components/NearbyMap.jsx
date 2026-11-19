/**
 * NearbyMap — "Gaming Cafés Near You" section for the Landing page.
 *
 * Uses browser Geolocation API to get user location, then fetches
 * nearby cafés from our own backend (/api/cafes/nearby).
 * Renders a Google Map with markers for each café.
 * Falls back to manual location search if permission denied.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../services/api';
import { loadGoogleMaps, getGoogleMapsApiKey } from './GoogleMapsLoader';

const MAPS_API_KEY = getGoogleMapsApiKey();
const MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

function distanceLabel(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Create an SVG circle element for the user location marker */
function createUserLocationSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = '<circle cx="12" cy="12" r="8" fill="#38bdf8" stroke="#fff" stroke-width="3"/>';
  return svg;
}

/** Create an SVG arrow element for café markers */
function createCafePinSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#f97316" stroke="#ea580c" stroke-width="0.5"/>';
  return svg;
}

export default function NearbyMap() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const userMarkerRef = useRef(null);
  const acContainerRef = useRef(null);
  const acElementRef = useRef(null);

  // Callback ref for the autocomplete container — remounts the element when container renders
  const setAcContainer = useCallback((node) => {
    acContainerRef.current = node;
    if (node && acElementRef.current && !node.contains(acElementRef.current)) {
      node.innerHTML = '';
      node.appendChild(acElementRef.current);
    }
  }, []);

  const [status, setStatus] = useState('idle'); // idle | requesting | denied | loading | ready | error | no-key
  const [cafes, setCafes] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [selectedCafe, setSelectedCafe] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null); // meters

  // No API key — skip entire section
  if (!MAPS_API_KEY) return null;

  const fetchNearbyCafes = useCallback(async (lat, lng) => {
    setStatus('loading');
    try {
      const res = await publicApi.get(`/cafes/nearby?lat=${lat}&lng=${lng}&maxDistance=10000`);
      setCafes(res.data.data.cafes || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Load maps API once
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch(() => setStatus('error'));
  }, []);

  // Init map once maps API script is ready — use importLibrary("maps") for async mode
  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { Map, InfoWindow } = await window.google.maps.importLibrary('maps');
        if (cancelled || mapInstanceRef.current) return;
        const map = new Map(mapRef.current, {
          center: { lat: 22.9734, lng: 78.6569 },
          zoom: 5,
          mapId: MAPS_MAP_ID,
          mapTypeId: 'roadmap',
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapInstanceRef.current = map;
        infoWindowRef.current = new InfoWindow();
      } catch (err) {
        console.error('[NearbyMap] Map init failed:', err);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [mapsReady]);

  const placeMarkers = useCallback(async (maps, map, cafes, userLat, userLng) => {
    // Clear old markers
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    if (userMarkerRef.current) userMarkerRef.current.map = null;

    // Load marker library
    const { AdvancedMarkerElement } = await maps.importLibrary('marker');

    // User location marker
    userMarkerRef.current = new AdvancedMarkerElement({
      position: { lat: userLat, lng: userLng },
      map,
      title: 'Your Location',
      content: createUserLocationSvg(),
      zIndex: 10,
    });

    // Fit bounds
    const bounds = new maps.LatLngBounds();
    bounds.extend({ lat: userLat, lng: userLng });

    cafes.forEach((cafe) => {
      const [lng, lat] = cafe.location.coordinates;
      bounds.extend({ lat, lng });

      const marker = new AdvancedMarkerElement({
        position: { lat, lng },
        map,
        title: cafe.name,
        content: createCafePinSvg(),
      });

      marker.addEventListener('gmp-click', () => {
        setSelectedCafe(cafe);
        const iw = infoWindowRef.current;
        iw.setContent(`
          <div style="font-family:Inter,sans-serif;background:#1a1a1a;color:#f4f4f5;padding:12px 14px;border-radius:8px;min-width:200px;max-width:260px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:#f97316">${cafe.name}</div>
            ${cafe.address ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:6px">📍 ${cafe.address}</div>` : ''}
            <div style="font-size:12px;color:#9ca3af;margin-bottom:10px">📏 ${distanceLabel(cafe.distance)} away</div>
            <div style="font-size:13px;margin-bottom:10px">From <strong style="color:#f97316">${cafe.currency || '₹'}${cafe.pricePerHour}/hr</strong></div>
            <a href="/cafe/${cafe.slug}" style="display:inline-block;background:#f97316;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">View Café →</a>
          </div>
        `);
        iw.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60 });
      if (cafes.length === 0) {
        map.setCenter({ lat: userLat, lng: userLng });
        map.setZoom(13);
      }
    }
  }, []);

  // When cafes + userPos both ready, place markers
  useEffect(() => {
    if (!mapsReady || !mapInstanceRef.current || !userPos || status !== 'ready') return;
    placeMarkers(window.google.maps, mapInstanceRef.current, cafes, userPos.lat, userPos.lng);
  }, [mapsReady, cafes, userPos, status, placeMarkers]);

  // Trigger resize when map becomes visible so tiles render correctly
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(status === 'loading' || status === 'ready')) return;
    // importLibrary("maps") is already resolved by this point; event is safe to use
    window.google?.maps?.event?.trigger(map, 'resize');
  }, [status]);

  // Manual search autocomplete — PlaceAutocompleteElement (new API)
  useEffect(() => {
    if (!mapsReady || acElementRef.current) return;

    (async () => {
      try {
        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places');
        const acEl = new PlaceAutocompleteElement();
        acEl.id = 'nearby-autocomplete';
        acEl.style.cssText = 'width:100%;';
        acElementRef.current = acEl;

        acEl.addEventListener('gmp-select', async (event) => {
          const placePrediction = event.placePrediction;
          if (!placePrediction) return;
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ['formattedAddress', 'location'] });
          const loc = place.location;
          if (!loc) return;
          const lat = loc.lat();
          const lng = loc.lng();
          setUserPos({ lat, lng });
          fetchNearbyCafes(lat, lng);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat, lng });
            mapInstanceRef.current.setZoom(12);
          }
        });

        // Mount into container if it's already rendered
        if (acContainerRef.current && !acContainerRef.current.hasChildNodes()) {
          acContainerRef.current.appendChild(acEl);
        }
      } catch (err) {
        console.warn('PlaceAutocompleteElement (NearbyMap) failed to load:', err);
      }
    })();
  }, [mapsReady, fetchNearbyCafes]);

  const requestLocation = () => {
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        console.log(`[GamingHub] Location: lat=${lat}, lng=${lng}, accuracy=±${Math.round(accuracy)}m`);
        setUserPos({ lat, lng });
        setLocationAccuracy(Math.round(accuracy));

        // Warn if accuracy is poor (> 1 km)
        if (accuracy > 1000) {
          console.warn(`[GamingHub] Location accuracy is low (±${Math.round(accuracy)}m). Results may not reflect your exact position.`);
        }

        fetchNearbyCafes(lat, lng);
      },
      (err) => {
        console.warn('[GamingHub] Geolocation error:', err.message);
        setStatus('denied');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  const showMap = status === 'loading' || status === 'ready';

  return (
    <section className="nearby-section">
      <div className="nearby-inner">
        <span className="section-eyebrow">Discover</span>
        <h2 className="nearby-title">Gaming Cafés Near You</h2>
        <p className="nearby-subtitle">Find registered Gaming Hub cafés in your area.</p>

        {/* ── States ── */}
        {status === 'idle' && (
          <div className="nearby-cta-box">
            <div className="nearby-cta-icon">📍</div>
            <p>Allow location access to discover nearby cafés.</p>
            <button className="btn btn-primary" onClick={requestLocation}>
              Use My Location
            </button>
            <div className="nearby-manual-label">or search manually</div>
            <div ref={setAcContainer} className="nearby-manual-ac-container" />
          </div>
        )}

        {status === 'requesting' && (
          <div className="nearby-cta-box">
            <div className="spinner" style={{ marginBottom: 'var(--space-4)' }} />
            <p>Requesting your location…</p>
          </div>
        )}

        {status === 'denied' && (
          <div className="nearby-cta-box">
            <div className="nearby-cta-icon">🔒</div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Location permission denied. Search manually:</p>
            <div ref={setAcContainer} className="nearby-manual-ac-container" />
          </div>
        )}

        {status === 'error' && (
          <div className="nearby-cta-box">
            <div className="nearby-cta-icon">⚠️</div>
            <p>Could not load map. Please try again.</p>
            <button className="btn btn-ghost btn-sm" onClick={requestLocation}>Retry</button>
          </div>
        )}

        {/* ── Map ── always in DOM so Google Maps can initialise on it */}
        <div
          ref={mapRef}
          className="nearby-map"
          style={
            showMap
              ? { opacity: status === 'loading' ? 0.5 : 1 }
              : { height: 0, overflow: 'hidden', visibility: 'hidden' }
          }
        />

        {/* ── Map overlay + Results ── */}
        {showMap && (
          <>
            {locationAccuracy > 1000 && (
              <div className="nearby-accuracy-warning">
                <span>⚠️ Location accuracy is low (±{locationAccuracy > 1000 ? `${(locationAccuracy / 1000).toFixed(1)} km` : `${locationAccuracy} m`}). Results may not reflect your exact area.</span>
                <button className="btn btn-ghost btn-sm" onClick={requestLocation}>Retry</button>
              </div>
            )}

            {status === 'loading' && (
              <div className="nearby-loading">
                <div className="landing-loading-spinner" />
                Finding nearby cafés…
              </div>
            )}

            {status === 'ready' && cafes.length === 0 && (
              <div className="nearby-empty">
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>🎮</div>
                <p>No Gaming Hub cafés found within 10 km. <a href="#cafes-section" style={{ color: 'var(--color-accent)' }}>Browse all cafés →</a></p>
              </div>
            )}

            {status === 'ready' && cafes.length > 0 && (
              <div className="nearby-cafe-list">
                {cafes.map((cafe) => {
                  const [lng, lat] = cafe.location.coordinates;
                  return (
                    <div
                      key={cafe._id}
                      className={`nearby-cafe-card ${selectedCafe?._id === cafe._id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCafe(cafe);
                        const map = mapInstanceRef.current;
                        if (map) { map.setCenter({ lat, lng }); map.setZoom(16); }
                        // Open info window on the matching marker
                        const idx = cafes.findIndex((c) => c._id === cafe._id);
                        const marker = markersRef.current[idx];
                        if (marker?.content) {
                          marker.content.classList.add('marker-bounce');
                          setTimeout(() => { marker.content.classList.remove('marker-bounce'); }, 1500);
                        }
                      }}
                    >
                      <div className="nearby-cafe-name">{cafe.name}</div>
                      {cafe.address && <div className="nearby-cafe-addr">📍 {cafe.address}</div>}
                      <div className="nearby-cafe-meta">
                        <span className="nearby-cafe-dist">📏 {distanceLabel(cafe.distance)}</span>
                        <span className="nearby-cafe-price">{cafe.currency || '₹'}{cafe.pricePerHour}/hr</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 'var(--space-2)', width: '100%' }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/cafe/${cafe.slug}`); }}
                      >
                        View Café →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

