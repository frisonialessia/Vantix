import "./globals.css";

export const metadata = {
  title: "Vantix — Market & Customer Intelligence",
  description: "Predictive intelligence to maximize financial value. Predict churn and CLV, and turn it into decisions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
