import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "../lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { ChallengeProvider } from "@/components/dashboard/ChallengeContext";
import SocketRegistration from "@/components/dashboard/SocketRegistration";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Chain App",
  description: "Chain App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen w-full bg-background text-foreground flex", inter.className, {
        "debug-screens": process.env.NODE_ENV === "development",
      })}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <ChallengeProvider>
            <SocketRegistration />
            {children}
          </ChallengeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
