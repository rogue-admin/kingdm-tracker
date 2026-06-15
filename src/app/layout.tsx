import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://kingdm-tracker.vercel.app"),

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

  creator: "Rogue",
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