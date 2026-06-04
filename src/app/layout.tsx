import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "~/components/layout/ThemeProvider";
import { BottomNav } from "~/components/layout/BottomNav";
import { ServiceWorkerRegistrar } from "~/components/layout/ServiceWorkerRegistrar";
import { ToastContainer } from "~/components/ui/ToastContainer";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Panelia",
  description: "A Mihon-inspired PWA manga reader.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakarta.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ServiceWorkerRegistrar />
          <main className="pb-24">{children}</main>
          <BottomNav />
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}