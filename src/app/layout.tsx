import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/lib/firebase/AuthContext";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://rivafy.com'),
  title: {
    default: 'Rivafy Studio — Build. Embed. Automate.',
    template: '%s | Rivafy Studio',
  },
  description:
    'Rivafy Studio — Build. Embed. Automate. Build, train, and embed intelligent RAG AI chatbots on any website in 60 seconds with zero runtime dependencies and isolated Shadow DOM technology.',
  keywords: [
    'Rivafy Studio',
    'Rivafy',
    'Build Embed Automate',
    'AI Chatbot',
    'Website Chatbot',
    'RAG Chatbot',
    'Customer Support AI',
    'Shadow DOM Chatbot',
    'Qdrant Vector Search',
    'OpenAI Chatbot',
    'NVIDIA NIM AI',
  ],
  authors: [{ name: 'Rivafy Studio' }],
  creator: 'Rivafy Studio',
  publisher: 'Rivafy Studio',
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
    title: 'Rivafy Studio — Build. Embed. Automate.',
    description:
      'Rivafy Studio — Build. Embed. Automate. Train AI on your website knowledge and embed an isolated, customizable floating chatbot on WordPress, Webflow, Shopify, or React.',
    url: 'https://rivafy.com',
    siteName: 'Rivafy Studio',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Rivafy Studio Platform Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rivafy Studio — Build. Embed. Automate.',
    description:
      'Rivafy Studio — Build. Embed. Automate. Embed intelligent AI chatbots on any website with isolated Shadow DOM and multi-model LLMs.',
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
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased font-sans`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

              :root {
                --font-sans: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                --font-heading: 'Poppins', sans-serif;
              }
              body {
                font-family: 'Poppins', var(--font-sans), sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              h1, h2, h3, h4, .font-heading {
                font-family: 'Poppins', var(--font-heading), sans-serif;
                letter-spacing: -0.02em;
              }
            `,
          }}
        />
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
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
          <ScrollToTop />
        </AuthProvider>
      </body>
    </html>
  );
}
