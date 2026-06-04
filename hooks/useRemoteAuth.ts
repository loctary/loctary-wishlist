// Thin re-export so host pages can use the auth hook without knowing
// the MF module path. Falls back to a no-op if loctary_auth isn't loaded yet.
export { useAuth } from 'loctary_auth/useAuth';
