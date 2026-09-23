import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Distributor Map',
  description: 'Manage and publish physical retail locations for Shopify.',
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
