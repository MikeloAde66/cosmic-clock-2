import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Astro Simulator',
  description: 'A virtual observatory: lunar grid targeting, the live Sun, and atmosphere probe drops.',
};

export const viewport: Viewport = {
  themeColor: '#07090e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
