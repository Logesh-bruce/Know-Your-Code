import type { Metadata } from "next";
import "@/styles/variables.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "KnowYourCode — Prove you understand your code",
    template: "%s · KnowYourCode",
  },
  description:
    "Analyzes GitHub repositories and helps developers prove they understand their own code through AI-powered explanations, knowledge tests, and interview practice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}