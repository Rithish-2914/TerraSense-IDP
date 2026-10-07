/**
 * Where the Flask backend lives.
 *
 * Defaults to the port app.py uses out of the box. Override with VITE_API_BASE
 * in .env - needed on macOS, where AirPlay Receiver occupies port 5000.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5000";
