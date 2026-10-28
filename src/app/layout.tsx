import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

const geistSans = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-geist-sans", weight: "100 900" });
const geistMono = localFont({ src: "./fonts/GeistMonoVF.woff", variable: "--font-geist-mono", weight: "100 900" });
export const metadata: Metadata = { title: { default: "OtakuGuessr — Daily Anime Games", template: "%s | OtakuGuessr" }, description: "Put your anime knowledge to the test with daily guessing games." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className="dark"><body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#080811] antialiased`}><Navbar />{children}<Footer /></body></html>; }
