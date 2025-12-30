import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrafficLens - Website Traffic Analytics",
  description: "Analyze website traffic data for multiple domains. Get insights on monthly visits, growth trends, engagement metrics, and more.",
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

