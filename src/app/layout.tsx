import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#050505",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://kingdm-tracker.vercel.app"
  ),

  title: {
    default: "The Kingdm Trade Tracker",
    template: "%s | The Kingdm Trade Tracker",
  },

  description:
    "Official session results, community leaderboards, member performance, and trading recaps from The Kingdm.",

  applicationName: "The Kingdm Trade Tracker",

  authors: [
    {
      name: "Rogue Tech",
    },
  ],

  creator: "Rogue Tech",
  publisher: "Rogue Tech",

  openGraph: {
    title: "The Kingdm Trade Tracker",
    description:
      "Official session results, community leaderboards, member performance, and trading recaps from The Kingdm.",
    url: "https://kingdm-tracker.vercel.app",
    siteName: "The Kingdm Trade Tracker",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "The Kingdm Trade Tracker",
    description:
      "Official session results, community leaderboards, member performance, and trading recaps from The Kingdm.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#050505",
          minHeight: "100vh",
          color: "white",
        }}
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}