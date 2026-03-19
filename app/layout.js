export const metadata = {
  title: "Price Search",
  description: "Поиск по прайсам"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        {children}
      </body>
    </html>
  );
}
