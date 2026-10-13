/**
 * La mascota de PREXI como logotipo: un recorte de la cara del pingüino de
 * `/pinguino.png` (la misma ilustración del inicio de sesión), así la marca
 * tiene un solo personaje en toda la aplicación. El recorte se hace por CSS
 * para no mantener un segundo archivo de imagen.
 */
export function LogoPinguino({ size = 46, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="PREXI"
      className={`block shrink-0 rounded-[14px] bg-gradient-to-br from-[#0B2A5E] to-[#04162E] shadow-lg shadow-black/40 ring-1 ring-white/15 ${className}`}
      style={{
        width: size, height: size,
        // La cara ocupa aprox. x[550..970], y[60..480] de la imagen de 1536×1024.
        backgroundImage: 'url(/pinguino.png), linear-gradient(135deg, #0B2A5E, #04162E)',
        backgroundSize: '366% auto, cover',
        backgroundPosition: '49% 10%, center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
