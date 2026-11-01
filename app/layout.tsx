import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { WorkspaceProvider } from '@/components/WorkspaceContext';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'FoodSpot — Online Food Ordering & Delivery Platform',
  description:
    'End-to-end multi-role food ordering and delivery platform with real-time order tracking, restaurant & delivery partner dashboards, admin analytics, and Yantra Ticketing Agent integration.',
  openGraph: {
    title: 'FoodSpot — Online Food Ordering & Delivery Platform',
    description:
      'End-to-end multi-role food ordering and delivery platform with real-time order tracking, restaurant & delivery partner dashboards, admin analytics, and Yantra Ticketing Agent integration.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FoodSpot — Online Food Ordering & Delivery Platform',
    description:
      'End-to-end multi-role food ordering and delivery platform with real-time order tracking, restaurant & delivery partner dashboards, admin analytics, and Yantra Ticketing Agent integration.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#FAF9F6] text-stone-900 antialiased selection:bg-orange-600 selection:text-white font-sans"
      >
        <WorkspaceProvider>{children}</WorkspaceProvider>
        {/* yantra-support-widget:start — Placed before </body> per Yantra docs */}
        <script
          src="https://www.yantraaicofounder.com/api/external/ticketing/widget.js"
          data-api-key="ytk_Hbp3SOJN4gerV_RrDtwzxEORf3_sq4s2BLByEzZUVgTVOP4E"
          defer
        ></script>
        {/* yantra-support-widget:end */}
      </body>
    </html>
  );
}
