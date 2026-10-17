import type { Product } from '@/lib/domain';
export function ProductArt({kind,className=''}:{kind:Product['art'];className?:string}) {
  return <svg viewBox="0 0 160 160" className={`product-art ${className}`} aria-hidden="true">
    <ellipse cx="80" cy="138" rx="43" ry="8" fill="#9fc9e5" opacity=".08"/>
    {kind==='milk'?<><path d="M48 38 62 17h45l12 22v94H48Z" fill="#ffffff" stroke="#a6cfe9" strokeWidth="2"/><path d="m48 38 17-12h41l13 13H48Z" fill="#f2f9fe"/><path d="M48 72h71v43H48Z" fill="#e5f2fb"/><path d="M105 40h14v92h-14Z" fill="#8bb9dc" opacity=".14"/><path d="M61 17h46v9H61Z" fill="#accfe7"/><text x="82" y="96" textAnchor="middle" fill="#526b86" fontSize="16" fontWeight="700">MILK</text><path d="M71 54q10-13 20 0-10 16-20 0" fill="#bad9ed"/></>:kind==='apple'?<><path d="M78 45C35 18 23 67 37 104c13 37 32 35 43 29 13 6 36 9 47-30 14-42-5-83-45-57" fill="#fcecf3" stroke="#edb8cf" strokeWidth="2"/><path d="M50 58q-17 25-2 49" fill="none" stroke="#edb8cf" strokeWidth="7" strokeLinecap="round"/><path d="M79 47q-4-23 7-29" fill="none" stroke="#98b6d0" strokeWidth="6" strokeLinecap="round"/><path d="M82 32q26-28 40-12-15 25-40 12" fill="#bfddef"/></>:<><path d="M44 36q-9-18 8-23h57l9 23-8 14 13 71q2 17-17 17H53q-18 0-16-17l10-71Z" fill="#fff" stroke="#a6cfe9" strokeWidth="2"/><path d="M51 72q0-23 26-23t30 23v47H51Z" fill="#bad7ed"/><path d="M59 76q-1-18 20-18t20 18v35H59Z" fill="#f4f9fe"/><path d="M38 93h85v28H38Z" fill="#e9f2fc"/><text x="80" y="112" textAnchor="middle" fill="#526b86" fontSize="13" letterSpacing="2">BAKERY</text><path d="m45 35 65 0" stroke="#accfe7" strokeWidth="3"/></>}
  </svg>;
}
export function Mascot({mood='idle'}:{mood?:string}) {
  return <div className={`mascot mascot-${mood}`} role="img" aria-label="結帳小幫手小智"/>;
}
