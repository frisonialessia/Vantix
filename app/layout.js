import "./globals.css";

export const metadata = {
  title: "Vantix — Market & Customer Intelligence",
  description: "Inteligencia predictiva para maximizar el valor financiero. Predice churn y CLV, y tradúcelo en decisiones.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
