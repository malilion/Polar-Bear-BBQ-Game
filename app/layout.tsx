import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '北極熊烤肉店 3D｜雪地裡，開飯囉！',
  description: '旋轉探索立體雪地場景，經營北極熊的小小烤肉店。掌握火候、送上熱食，挑戰 90 秒的暖心營業。',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
