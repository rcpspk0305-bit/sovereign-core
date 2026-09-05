import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sovereign-Core | Local AI Workbench',
  description: 'Production-quality, privacy-first local AI workbench with Ollama, RAG, Tools, and Auditing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
