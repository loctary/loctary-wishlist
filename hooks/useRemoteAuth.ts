// Kept for potential future use. The AppBar and AuthGuard now use useAuth (full
// /me fetch) and direct cookie reads respectively. This hook is no longer wired
// to any component but left here so imports don't break if referenced elsewhere.
export { useAuth as useRemoteAuth } from './useAuth';
