import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ScrollToTop } from "@/components/ScrollToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sitebotstudio.com'),
  title: {
    default: 'SiteBot Studio — Multi-Tenant AI Chatbot Platform for Any Website',
    template: '%s | SiteBot Studio',
  },
  description:
    'Build, train, and embed intelligent RAG AI chatbots on any website in 60 seconds with zero runtime dependencies and isolated Shadow DOM technology.',
  keywords: [
    'AI Chatbot',
    'Website Chatbot',
    'RAG Chatbot',
    'Customer Support AI',
    'SiteBot Studio',
    'Shadow DOM Chatbot',
    'Qdrant Vector Search',
    'OpenAI Chatbot',
    'NVIDIA NIM AI',
  ],
  authors: [{ name: 'SiteBot Studio' }],
  creator: 'SiteBot Studio',
  publisher: 'SiteBot Studio',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'SiteBot Studio — Multi-Tenant AI Chatbot Platform for Any Website',
    description:
      'Train AI on your website knowledge and embed an isolated, customizable floating chatbot on WordPress, Webflow, Shopify, or React.',
    url: 'https://sitebotstudio.com',
    siteName: 'SiteBot Studio',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'SiteBot Studio Platform Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SiteBot Studio — Multi-Tenant AI Chatbot Platform',
    description:
      'Embed intelligent AI chatbots on any website with isolated Shadow DOM and multi-model LLMs.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('sitebot_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}
