import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hannibal — AI Product Management",
  description: "AI-native product workspace. Cursor for builders — solo founders, product engineers, and small AI-native teams shipping from idea to launch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorBackground: "#1a1a1a",
          colorInputBackground: "#2b2b2b",
          colorText: "#fafafa",
          colorTextSecondary: "#a3a3a3",
          colorPrimary: "#e8e8e8",
          colorDanger: "#e54d2e",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans), sans-serif",
        },
        elements: {
          card: "shadow-none border border-[oklch(1_0_0/10%)]",
          footerActionLink: "text-[#e8e8e8] hover:text-white",
        },
      }}
    >
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <Providers>{children}</Providers>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
