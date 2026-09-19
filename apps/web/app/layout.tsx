import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './cockpit.css';

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '45 920',
});

export const metadata: Metadata = {
  title: '오늘의 관제판',
  description: '프로젝트별 할 일과 오늘의 가용시간을 함께 관리합니다.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
