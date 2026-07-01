// app/layout.tsx
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Idea Uno OS — Plataforma Inmobiliaria Empresarial',
  description:
    'Plataforma centralizada para gestión de inventario de propiedades, operaciones inmobiliarias, asesores, cumplimiento PLD/KYC y reportes ejecutivos.',
  keywords: ['inmobiliaria', 'propiedades', 'plataforma', 'idea uno', 'PLD', 'KYC'],
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={plusJakartaSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
