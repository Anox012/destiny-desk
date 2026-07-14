import "./globals.css";

export const metadata = {
  title: "Destiny Desk",
  description: "โต๊ะไพ่ทาโรต์ส่วนตัว จัดชุดข้อมูลไพ่เพื่อคัดลอกไปให้ AI ทำนายแบบ Storytelling",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,600;0,700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
