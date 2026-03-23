import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppWidget from "@/components/WhatsAppWidget";

export const metadata: Metadata = {
  title: "जनशक्ति.AI — AI for Local Leadership & Public Trust",
  description: "AI-powered citizen governance platform connecting citizens, data, and leaders end-to-end. Multi-modal complaint collection, intelligent prioritization, GPS-verified work proof, social media intelligence, and AI communication engine.",
  keywords: "governance, AI, citizen complaints, smart governance, India, civic tech",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        <Footer />
        <WhatsAppWidget />
      </body>
    </html>
  );
}
