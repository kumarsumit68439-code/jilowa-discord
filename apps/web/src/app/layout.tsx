import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jilowa — Discord Clone',
  description: 'Production real-time chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
