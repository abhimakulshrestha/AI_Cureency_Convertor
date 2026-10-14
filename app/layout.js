import "./globals.css";

export const metadata = {
  title: "AI Currency Converter",
  description: "Convert currencies with daily exchange rates and natural-language requests."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
