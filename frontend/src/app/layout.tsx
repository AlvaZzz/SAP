import type { Metadata } from 'next';
import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { TourManager } from '@/components/tour';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'PREXI UPEA — Aprende Python con IA',
  description: 'Plataforma adaptativa con IA y gamificación para aprender programación en Python.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${sora.variable} ${mono.variable}`}>
      <body className="bg-app font-sans text-fg antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
            {/* Tours de onboarding por módulo (persistidos por usuario). */}
            <TourManager />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
