/** @type {import('next').NextConfig} */
// Proxy /api → API NestJS, para que la cookie httpOnly funcione sin CORS.
//
// En producción API_URL debe ser el subdominio propio del backend
// (https://api.midominio.com). Si falta, el rewrite apuntaría a localhost:4000
// dentro del contenedor de Vercel y TODAS las llamadas fallarían en tiempo de
// ejecución, no de despliegue: se prefiere romper el build, que es visible.
const API = process.env.API_URL || 'http://localhost:4000';
if (process.env.NODE_ENV === 'production' && !process.env.API_URL) {
  throw new Error(
    'Falta API_URL. En Vercel debe valer la URL del backend (p. ej. https://api.midominio.com), sin barra final.',
  );
}

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
};

module.exports = nextConfig;
