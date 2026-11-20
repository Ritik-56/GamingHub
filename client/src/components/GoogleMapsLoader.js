/**
 * GoogleMapsLoader.js — Shared singleton Google Maps loader.
 *
 * ROOT CAUSE FIX:
 * With `loading=async`, the Maps JS API does NOT put Map, InfoWindow, etc.
 * directly on window.google.maps. Everything goes through importLibrary().
 * importLibrary() itself may not be callable immediately when onload fires.
 *
 * This module:
 *  1. Injects the script once (guarded by a window-level singleton).
 *  2. Polls until importLibrary is truly callable.
 *  3. Pre-loads the 'maps' library and caches its exports.
 *  4. Exports getMapsLib() / getMarkerLib() / getPlacesLib() so components
 *     never need to call importLibrary themselves — they get cached results.
 */

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function getGoogleMapsApiKey() {
  return MAPS_API_KEY;
}

// ─── Shared state on window so HMR reloads keep the same promise ─────────────
function getSharedPromise() { return window.__ghMapsPromise || null; }
function setSharedPromise(p) { window.__ghMapsPromise = p; }

// Cached library namespaces (populated once load resolves)
const _libs = {};

/**
 * loadGoogleMaps()
 * Returns a Promise that resolves when:
 *   - The Maps JS API script has loaded
 *   - window.google.maps.importLibrary is a real, callable function
 *   - The 'maps' core library has been pre-loaded (Map, InfoWindow, LatLngBounds)
 *
 * Safe to call multiple times — always returns the same promise.
 */
export function loadGoogleMaps() {
  // If already resolved and importLibrary is functional, resolve immediately
  if (_libs.maps && typeof window.google?.maps?.importLibrary === 'function') {
    return Promise.resolve();
  }

  const existing = getSharedPromise();
  if (existing) return existing;

  const promise = _doLoad();
  setSharedPromise(promise);

  // On failure, clear so the next call retries
  promise.catch(() => {
    if (window.__ghMapsPromise === promise) {
      window.__ghMapsPromise = null;
    }
  });

  return promise;
}

async function _doLoad() {
  if (!MAPS_API_KEY) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY is not set');
  }

  // Check whether the script is already in the DOM (HMR, CDN, etc.)
  const alreadyInDom = !!document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]'
  );

  if (!alreadyInDom) {
    // Inject script but DON'T resolve on onload — importLibrary may not be
    // ready yet at that point. Resolve only after the poll below confirms it.
    await _injectScript();
  }

  // Poll until importLibrary is truly callable (handles loading=async race)
  await _waitForImportLibrary();

  // Pre-load and cache the core libraries
  _libs.maps = await window.google.maps.importLibrary('maps');
}

function _injectScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&loading=async`;
    script.async = true;
    script.defer = true;
    // onload fires when the bootstrap JS runs; importLibrary may not be ready
    // yet, but we can start the poll from here.
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
}

function _waitForImportLibrary(timeoutMs = 20000) {
  if (typeof window.google?.maps?.importLibrary === 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (typeof window.google?.maps?.importLibrary === 'function') {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error('Timed out waiting for google.maps.importLibrary'));
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  });
}

// ─── Cached library accessors ─────────────────────────────────────────────────

/**
 * getMapsLib()
 * Returns the pre-loaded 'maps' library namespace { Map, InfoWindow, LatLngBounds, … }.
 * Only valid after loadGoogleMaps() has resolved.
 */
export function getMapsLib() {
  return _libs.maps || null;
}

/**
 * importMapsLibrary(name)
 * Convenience: ensures the SDK is loaded, then returns the named library.
 * Results are cached by the browser's importLibrary internal cache.
 */
export async function importMapsLibrary(name) {
  await loadGoogleMaps();
  if (_libs[name]) return _libs[name];
  _libs[name] = await window.google.maps.importLibrary(name);
  return _libs[name];
}
