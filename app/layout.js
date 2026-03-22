import "./globals.css";
import Header from "../components/Header";

export const metadata = {
  title: "b2bpart.ru",
  description: "Поиск по прайсам"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          background: "#fafafa",
          color: "#111"
        }}
      >
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
