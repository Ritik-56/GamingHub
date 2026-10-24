import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { customerApi, adminApi } from '../services/api';

// ---------------------------------------------------------------------------
// AuthContext — dual-scope authentication
//
// Customer state  → customerToken / customerUser (sessionStorage: customerToken)
// Admin state     → adminToken   / adminUser    (sessionStorage: adminToken)
//
// Both scopes are kept fully isolated. Logging in/out of one scope never
// touches the other scope's state or storage key.
//
// KEY DESIGN DECISION: authScope is stored in React state (not only
// sessionStorage) so that derived values like `isAuthenticated` and `user`
// re-render correctly when the scope changes within the same page load.
// sessionStorage is used only as the persistence layer across page reloads.
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // ── Customer scope ──────────────────────────────────────────────────────
  const [customerToken, setCustomerTokenState] = useState(
    () => sessionStorage.getItem('customerToken') || null
  );
  const [customerUser, setCustomerUser] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(
    () => !!sessionStorage.getItem('customerToken')
  );

  // ── Admin / staff scope ─────────────────────────────────────────────────
  const [adminToken, setAdminTokenState] = useState(
    () => sessionStorage.getItem('adminToken') || null
  );
  const [adminUser, setAdminUser] = useState(null);
  const [adminLoading, setAdminLoading] = useState(
    () => !!sessionStorage.getItem('adminToken')
  );
  const [cafes, setCafes] = useState([]);
  const [currentCafe, setCurrentCafe] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  // ── Token persistence helpers ──────────────────────────────────────────

  const persistCustomerToken = useCallback((tok) => {
    setCustomerTokenState(tok);
    if (tok) {
      sessionStorage.setItem('customerToken', tok);
    } else {
      sessionStorage.removeItem('customerToken');
    }
  }, []);

  const persistAdminToken = useCallback((tok) => {
    setAdminTokenState(tok);
    if (tok) {
      sessionStorage.setItem('adminToken', tok);
    } else {
      sessionStorage.removeItem('adminToken');
    }
  }, []);

  // ── Fetch admin cafés ──────────────────────────────────────────────────

  const fetchCafes = useCallback(async () => {
    try {
      const res = await adminApi.get('/cafes/my');
      const cafeList = res.data.data.cafes;
      setCafes(cafeList);

      if (cafeList.length > 0) {
        const savedCafeId = sessionStorage.getItem('currentCafeId');
        const match =
          cafeList.find((c) => c.cafe._id === savedCafeId) || cafeList[0];
        setCurrentCafe(match.cafe);
        setCurrentRole(match.role);
        sessionStorage.setItem('currentCafeId', match.cafe._id);
      } else {
        setCurrentCafe(null);
        setCurrentRole(null);
      }
    } catch {
      setCafes([]);
      setCurrentCafe(null);
      setCurrentRole(null);
    }
  }, []);

  // ── Bootstrap: resolve stored customer token on mount ─────────────────

  useEffect(() => {
    if (!customerToken) {
      setCustomerLoading(false);
      return;
    }
    customerApi
      .get('/auth/me')
      .then((res) => setCustomerUser(res.data.data.user))
      .catch(() => {
        persistCustomerToken(null);
        setCustomerUser(null);
      })
      .finally(() => setCustomerLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentional: only runs on mount

  // ── Bootstrap: resolve stored admin token on mount ────────────────────

  useEffect(() => {
    if (!adminToken) {
      setAdminLoading(false);
      return;
    }
    adminApi
      .get('/auth/me')
      .then(async (res) => {
        setAdminUser(res.data.data.user);
        await fetchCafes();
      })
      .catch(() => {
        persistAdminToken(null);
        setAdminUser(null);
        setCafes([]);
        setCurrentCafe(null);
        setCurrentRole(null);
      })
      .finally(() => setAdminLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentional: only runs on mount

  // ── Login ──────────────────────────────────────────────────────────────
  // The `scope` is sent to the backend, which validates it against the user's
  // actual CafeMembership roles. The backend will reject:
  //   • scope='customer' if the user is OWNER/MANAGER/STAFF
  //   • scope='admin'    if the user has no staff membership
  // This means the frontend can NEVER silently cross-authenticate scopes.

  const login = useCallback(
    async (email, password, scope = 'admin') => {
      if (scope === 'customer') {
        // Sends scope to backend — backend enforces role check
        const res = await customerApi.post('/auth/login', { email, password, scope });
        const { token: tok, user: userData } = res.data.data;
        persistCustomerToken(tok);
        setCustomerUser(userData);
        // Update sessionStorage for page-reload persistence
        sessionStorage.setItem('authScope', 'customer');
        return userData;
      } else {
        const res = await adminApi.post('/auth/login', { email, password, scope });
        const { token: tok, user: userData } = res.data.data;
        persistAdminToken(tok);
        setAdminUser(userData);
        await fetchCafes();
        sessionStorage.setItem('authScope', 'admin');
        return userData;
      }
    },
    [persistCustomerToken, persistAdminToken, fetchCafes]
  );

  // ── Register ───────────────────────────────────────────────────────────

  const register = useCallback(
    async (name, email, phone, password, scope = 'admin') => {
      if (scope === 'customer') {
        const res = await customerApi.post('/auth/register', {
          name,
          email,
          phone,
          password,
          scope,
        });
        const { token: tok, user: userData } = res.data.data;
        persistCustomerToken(tok);
        setCustomerUser(userData);
        sessionStorage.setItem('authScope', 'customer');
        return userData;
      } else {
        const res = await adminApi.post('/auth/register', {
          name,
          email,
          phone,
          password,
          scope,
        });
        const { token: tok, user: userData } = res.data.data;
        persistAdminToken(tok);
        setAdminUser(userData);
        await fetchCafes();
        sessionStorage.setItem('authScope', 'admin');
        return userData;
      }
    },
    [persistCustomerToken, persistAdminToken, fetchCafes]
  );

  // ── Logout — scoped so only the targeted scope is cleared ─────────────

  const logout = useCallback(
    (scope) => {
      const target = scope || 'admin';

      if (target === 'customer') {
        persistCustomerToken(null);
        setCustomerUser(null);
        sessionStorage.removeItem('customerCafeSlug');
        // Only update authScope if currently set to customer
        if (sessionStorage.getItem('authScope') === 'customer') {
          // If admin is still logged in, revert to admin scope
          if (sessionStorage.getItem('adminToken')) {
            sessionStorage.setItem('authScope', 'admin');
          } else {
            sessionStorage.removeItem('authScope');
          }
        }
      } else {
        persistAdminToken(null);
        setAdminUser(null);
        setCafes([]);
        setCurrentCafe(null);
        setCurrentRole(null);
        sessionStorage.removeItem('currentCafeId');
        // Only update authScope if currently set to admin
        if (sessionStorage.getItem('authScope') === 'admin') {
          // If customer is still logged in, revert to customer scope
          if (sessionStorage.getItem('customerToken')) {
            sessionStorage.setItem('authScope', 'customer');
          } else {
            sessionStorage.removeItem('authScope');
          }
        }
      }
    },
    [persistCustomerToken, persistAdminToken]
  );

  // ── Café selection (admin scope) ───────────────────────────────────────

  const selectCafe = useCallback(
    (cafeId) => {
      const match = cafes.find((c) => c.cafe._id === cafeId);
      if (match) {
        setCurrentCafe(match.cafe);
        setCurrentRole(match.role);
        sessionStorage.setItem('currentCafeId', cafeId);
      }
    },
    [cafes]
  );

  // ── Derived flags ──────────────────────────────────────────────────────

  const isCustomerAuthenticated = !!customerUser;
  const isAdminAuthenticated = !!adminUser;

  // ── Context value ──────────────────────────────────────────────────────

  const value = {
    // Explicit per-scope flags — components should use these
    isCustomerAuthenticated,
    isAdminAuthenticated,
    customerUser,
    adminUser,

    // Generic proxy — reflects whichever scope is primary right now
    // (kept for backward compat; prefer explicit flags in new code)
    user: isAdminAuthenticated ? adminUser : customerUser,
    loading: customerLoading || adminLoading,
    isAuthenticated: isCustomerAuthenticated || isAdminAuthenticated,

    // Auth actions
    login,
    register,
    logout,

    // Admin-scope café data
    cafes,
    currentCafe,
    currentRole,
    fetchCafes,
    selectCafe,
    hasCafe: cafes.length > 0,
    isStaffOrAbove: ['OWNER', 'MANAGER', 'STAFF'].includes(currentRole),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
