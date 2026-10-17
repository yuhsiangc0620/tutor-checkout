import type { Metadata } from 'next';
import './globals.css';
import './flow.css';
export const metadata:Metadata={title:'好好結帳｜智慧導引原型',description:'一步一步，輕鬆完成結帳。PIR、RFID 與本機語音辨識互動原型。'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-Hant"><body>{children}</body></html>;}
