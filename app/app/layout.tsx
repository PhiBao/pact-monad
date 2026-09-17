import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../lib/wagmi";

export const metadata: Metadata = {
  title: "Pact — money only moves if the group means it",
  description:
    "Conditional group pots on Monad. Commit your share; funds release only when the group hits its rule. No tilt, no charge.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
