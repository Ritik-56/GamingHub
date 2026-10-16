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
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ── helpers ────────────────────────────────────────────────────────────────

function loadCustomerState() {
  return {
    token: sessionStorage.getItem('customerToken') || null,
    user: null, // resolved async on mount
  };
}

function loadAdminState() {
  return {
    token: sessionStorage.getItem('adminToken') || null,
    user: null,
    cafes: [],
    currentCafe: null,
    currentRole: null,
  };
}

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

  // ── Bootstrap: resolve stored customer token ───────────────────────────

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
  }, []); // Only on mount — customerToken is intentionally excluded to avoid
          // re-running when the value changes via login (handled inline there)

  // ── Bootstrap: resolve stored admin token ─────────────────────────────

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
  }, []); // Only on mount

  // ── Login ──────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email, password, scope = 'admin') => {
      if (scope === 'customer') {
        // Update authScope so the default api instance picks the right token
        // during the /auth/login call itself (needed before we have the token)
        sessionStorage.setItem('authScope', 'customer');

        const res = await customerApi.post('/auth/login', { email, password });
        const { token: tok, user: userData } = res.data.data;
        persistCustomerToken(tok);
        setCustomerUser(userData);
        return userData;
      } else {
        sessionStorage.setItem('authScope', 'admin');

        const res = await adminApi.post('/auth/login', { email, password });
        const { token: tok, user: userData } = res.data.data;
        persistAdminToken(tok);
        setAdminUser(userData);
        await fetchCafes();
        return userData;
      }
    },
    [persistCustomerToken, persistAdminToken, fetchCafes]
  );

  // ── Register ───────────────────────────────────────────────────────────

  const register = useCallback(
    async (name, email, phone, password, scope = 'admin') => {
      if (scope === 'customer') {
        sessionStorage.setItem('authScope', 'customer');

        const res = await customerApi.post('/auth/register', {
          name,
          email,
          phone,
          password,
        });
        const { token: tok, user: userData } = res.data.data;
        persistCustomerToken(tok);
        setCustomerUser(userData);
        return userData;
      } else {
        sessionStorage.setItem('authScope', 'admin');

        const res = await adminApi.post('/auth/register', {
          name,
          email,
          phone,
          password,
        });
        const { token: tok, user: userData } = res.data.data;
        persistAdminToken(tok);
        setAdminUser(userData);
        await fetchCafes();
        return userData;
      }
    },
    [persistCustomerToken, persistAdminToken, fetchCafes]
  );

  // ── Logout — scoped so only the targeted scope is cleared ─────────────

  const logout = useCallback(
    (scope) => {
      // Determine which scope to log out of
      const target = scope || sessionStorage.getItem('authScope') || 'admin';

      if (target === 'customer') {
        persistCustomerToken(null);
        setCustomerUser(null);
        // Only clear authScope if it was set to customer
        if (sessionStorage.getItem('authScope') === 'customer') {
          sessionStorage.removeItem('authScope');
        }
        sessionStorage.removeItem('customerCafeSlug');
      } else {
        persistAdminToken(null);
        setAdminUser(null);
        setCafes([]);
        setCurrentCafe(null);
        setCurrentRole(null);
        sessionStorage.removeItem('currentCafeId');
        // Only clear authScope if it was set to admin
        if (sessionStorage.getItem('authScope') === 'admin') {
          sessionStorage.removeItem('authScope');
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

  // "isAuthenticated" reflects the CURRENT authScope — used by route guards
  // and components that need to know if the current browsing context has a
  // valid session.
  const currentScope = sessionStorage.getItem('authScope');
  const isCustomerAuthenticated = !!customerUser;
  const isAdminAuthenticated = !!adminUser;

  // Generic isAuthenticated = true if the active scope has a user
  const isAuthenticated =
    currentScope === 'customer' ? isCustomerAuthenticated : isAdminAuthenticated;

  // The "user" in context = user for current scope
  const user = currentScope === 'customer' ? customerUser : adminUser;

  // Combined loading state
  const loading = customerLoading || adminLoading;

  // ── Context value ──────────────────────────────────────────────────────

  const value = {
    // Current-scope proxies (used by most components)
    user,
    loading,
    isAuthenticated,

    // Explicit per-scope flags (for components that need to know both)
    isCustomerAuthenticated,
    isAdminAuthenticated,
    customerUser,
    adminUser,

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
