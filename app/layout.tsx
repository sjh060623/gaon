import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'사이 — 시간으로 만나는 우리 사이',description:'최대 4명의 자동차·대중교통 이동시간을 비교해 모두에게 가까운 만남 장소를 찾아보세요.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
