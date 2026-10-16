import axios from 'axios';

// ---------------------------------------------------------------------------
// Two separate Axios instances — one per auth scope.
// This prevents a customer token from ever being attached to an admin request
// and vice versa, regardless of what authScope happens to be set in
// sessionStorage at the time of the call.
// ---------------------------------------------------------------------------

function makeApiInstance(getToken) {
  const instance = axios.create({
    baseURL: '/api',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error.response?.data?.message || error.message || 'Something went wrong';
      return Promise.reject(new Error(message));
    }
  );

  return instance;
}

// Public / unauthenticated requests (no Authorization header)
export const publicApi = makeApiInstance(() => null);

// Customer-scoped requests — always uses customerToken
export const customerApi = makeApiInstance(() =>
  sessionStorage.getItem('customerToken')
);

// Admin/owner/staff-scoped requests — always uses adminToken
export const adminApi = makeApiInstance(() =>
  sessionStorage.getItem('adminToken')
);

// Default export: picks the right instance based on current authScope.
// Used only by components that don't know their scope in advance (e.g. /auth/me
// on startup). All scoped components should import customerApi or adminApi
// directly.
const api = makeApiInstance(() => {
  const scope = sessionStorage.getItem('authScope');
  return scope === 'customer'
    ? sessionStorage.getItem('customerToken')
    : sessionStorage.getItem('adminToken');
});

export default api;
