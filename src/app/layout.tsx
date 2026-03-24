import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "2048 Shelby | Hot Storage Edition",
  description: "Next-gen 2048 integrated with Shelby Protocol and Aptos Blockchain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
