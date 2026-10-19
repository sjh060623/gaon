'use client';
import {useState,useMemo,useRef} from 'react';
import {Plus,Minus,LocateFixed,MapPin,Compass} from 'lucide-react';
import {PLACES,COLORS} from '@/lib/meet.mjs';
const ROADS=[
 'M-50 210 160 170 300 180 450 125 620 135 850 90','M40 360 175 325 335 340 470 275 660 282 840 230','M100 460 200 390 360 408 560 380 800 420','M30 70 220 140 370 150 540 180 820 160','M180 -20 205 140 185 290 255 550','M360 -10 355 170 420 310 430 550','M550 -10 530 150 580 310 650 550','M735 -20 700 160 740 330 710 550',
 'M0 280 165 260 325 278 510 235 800 310','M-20 115 160 105 310 75 450 90 650 20','M-20 410 150 440 335 430 470 470 810 475'
];
export default function AreaMap({people,selected,dirty,source}){
 const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});const drag=useRef(null);
 const geo=useMemo(()=>{
  const points=[...people.filter(p=>p.place).map(p=>p.place),...(selected?[selected.place]:[])];
  if(!points.length)return {x:126.995,y:37.535,scale:4100};
  const xs=points.map(p=>p.lng),ys=points.map(p=>p.lat);const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
  return {x,y,scale:Math.min(4300,Math.max(450,Math.min(540/(Math.max(...xs)-Math.min(...xs)||.1),270/(Math.max(...ys)-Math.min(...ys)||.06))))};
 },[people,selected]);
 const point=p=>({x:400+(p.lng-geo.x)*geo.scale,y:240-(p.lat-geo.y)*geo.scale*1.2});
 const center=selected?point(selected.place):{x:400,y:240};
 const riverPoints=[{lng:126.86,lat:37.557},{lng:126.92,lat:37.535},{lng:126.96,lat:37.521},{lng:126.99,lat:37.512},{lng:127.025,lat:37.525},{lng:127.065,lat:37.530},{lng:127.10,lat:37.521},{lng:127.16,lat:37.553}].map(point);
 const river='M'+riverPoints.map(p=>`${p.x} ${p.y}`).join(' L');
 return <section className="map-panel" aria-label="출발지와 만남 장소 위치 개요">
  <div className="map-top"><span className="map-chip"><span className="status-dot"/>{source==='demo'?'수도권 예시':'출발지 주변'} <span className="chip-divider"/> 위치 개요</span><span className="map-compass"><Compass size={19}/><span>N</span></span></div>
  <svg className="area-map" viewBox="0 0 800 480" role="img" aria-label="출발지와 추천 장소를 연결한 위치 개요도. 점선은 실제 이동 경로가 아닙니다." onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,pan};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current){const ratio=800/e.currentTarget.getBoundingClientRect().width;setPan({x:drag.current.pan.x+(e.clientX-drag.current.x)*ratio,y:drag.current.pan.y+(e.clientY-drag.current.y)*ratio});}}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <defs><pattern id="blocks" width="49" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><rect x="4" y="4" width="39" height="34" rx="4" fill="#e8edf4" stroke="#dfe6ef" strokeWidth=".4"/></pattern><filter id="pin-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#55769f" floodOpacity=".17"/></filter></defs>
   <rect width="800" height="480" fill="#eef3f9"/>
   <g transform={`translate(${pan.x} ${pan.y}) translate(400 240) scale(${zoom}) translate(-400 -240)`}>
    <rect x="-800" y="-500" width="2400" height="1500" fill="url(#blocks)"/>
    <path d="M225 -30 Q310 15 280 65 T340 140 Q250 165 207 105 T225 -30M565 325 Q625 280 670 335 T720 405 Q650 440 600 405Z" fill="#dce8e7" stroke="#d2e0e1"/>
    <g fill="none" stroke="#f9fbfe" strokeWidth="9">{ROADS.map((d,i)=><path key={i} d={d}/>)}</g>
    <g fill="none" stroke="#d6e0eb" strokeWidth=".6">{ROADS.map((d,i)=><path key={i} d={d}/>)}</g>
    <path d={river} fill="none" stroke="#bfd8ed" strokeWidth="40" strokeLinejoin="round" strokeLinecap="round"/><path d={river} fill="none" stroke="#d0e3f4" strokeWidth="27" strokeLinejoin="round"/>
    <text x={point({lng:126.951,lat:37.522}).x} y={point({lng:126.951,lat:37.522}).y+5} fill="#7ba0c5" fontSize="11" letterSpacing="8">한 강</text>
    {PLACES.filter(p=>!people.some(v=>v.place?.id===p.id)&&selected?.place.id!==p.id).map(p=>{const pt=point(p);if(pt.x<35||pt.x>765||pt.y<35||pt.y>450)return null;return <g key={p.id}><circle cx={pt.x} cy={pt.y} r="2.4" fill="#b0bfd2"/><text x={pt.x} y={pt.y+15} textAnchor="middle" fill="#91a3bb" fontSize="10">{p.name.replace('역','')}</text></g>;})}
    {!dirty&&selected?people.map((p,i)=>{if(!p.place)return null;const pt=point(p.place);return <g key={p.id}><path d={`M${pt.x} ${pt.y} Q${(pt.x+center.x)/2} ${Math.min(pt.y,center.y)-28} ${center.x} ${center.y}`} stroke={COLORS[i]} strokeWidth="2.3" fill="none" strokeDasharray="5 5" opacity=".65"/></g>;}):null}
    {people.map((p,i)=>{if(!p.place)return null;const pt=point(p.place),time=selected?.routes.find(r=>r.personId===p.id)?.minutes;return <g key={p.id} transform={`translate(${pt.x} ${pt.y})`} filter="url(#pin-shadow)"><circle r="19" fill={COLORS[i]} stroke="white" strokeWidth="4"/><text textAnchor="middle" dy="5" fontSize="13" fontWeight="700" fill="white">{String.fromCharCode(65+i)}</text><rect x="-54" y="28" width="108" height={time&&!dirty?43:28} rx="9" fill="white"/><text textAnchor="middle" y="46" fontSize="11" fill="#405577" fontWeight="600">{p.place.name.length>9?p.place.name.slice(0,8)+'…':p.place.name}</text>{time&&!dirty?<text textAnchor="middle" y="62" fontSize="11" fill={COLORS[i]}>{time}분</text>:null}</g>;})}
    {!dirty&&selected?<g transform={`translate(${center.x} ${center.y})`}><circle r="48" fill="#1387ff" opacity=".06"/><circle r="32" fill="#1387ff" opacity=".1"/><g filter="url(#pin-shadow)"><path d="M0 10 C-8 0-20-8-20-21 A20 20 0 1 1 20-21 C20-8 8 0 0 10" fill="#1387ff" stroke="white" strokeWidth="3"/><path d="m-8-21 5 5 11-12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><rect x="-64" y="16" width="128" height="34" rx="17" fill="#3d5f8c"/><text textAnchor="middle" y="38" fontSize="12" fill="white" fontWeight="600">{selected.place.name.length>9?selected.place.name.slice(0,8)+'…':selected.place.name}</text></g></g>:null}
   </g>
  </svg>
  <div className="map-bottom"><div className="map-key"><span className="key-line"/>점선은 위치 연결선입니다</div><div className="map-controls"><button type="button" aria-label="지도 확대" onClick={()=>setZoom(v=>Math.min(2.2,v+.2))}><Plus size={18}/></button><button type="button" aria-label="지도 축소" onClick={()=>setZoom(v=>Math.max(.6,v-.2))}><Minus size={18}/></button><span/><button type="button" aria-label="지도 위치 초기화" onClick={()=>{setPan({x:0,y:0});setZoom(1);}}><LocateFixed size={18}/></button></div></div>
  <div className="map-caption"><MapPin size={12}/> 위치 개요 · 배경 도로는 단순화한 그림이며 실제 경로가 아닙니다.</div>
 </section>;
}
