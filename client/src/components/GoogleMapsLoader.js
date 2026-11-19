/**
 * Shared singleton Google Maps loader.
 *
 * Both NearbyMap and LocationPicker import from here so there is only ONE
 * <script> tag and ONE load promise, no matter how many map components mount.
 *
 * The promise is reset to null on failure so a subsequent call retries
 * instead of returning an already-rejected promise forever.
 */

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let mapsLoadPromise = null;

export function getGoogleMapsApiKey() {
  return MAPS_API_KEY;
}

export function loadGoogleMaps() {
  // Already loaded synchronously — resolve immediately
  if (window.google?.maps?.Map) return Promise.resolve();

  // Reuse in-flight promise
  if (mapsLoadPromise) return mapsLoadPromise;

  // Create new load attempt
  mapsLoadPromise = new Promise((resolve, reject) => {
    // Check again in case another module loaded it while we waited
    if (window.google?.maps?.Map) { resolve(); return; }

    const existing = document.querySelector(
      `script[src*="maps.googleapis.com/maps/api/js"]`
    );
    if (existing) {
      // Script already in DOM (injected externally) — wait for it
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    // Do NOT request legacy 'places' library — use importLibrary('places') instead
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => {
      // Reset so the next call retries instead of returning a rejected promise forever
      mapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}
