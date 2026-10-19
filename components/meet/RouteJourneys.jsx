'use client';
import {Footprints,TrainFront,BusFront,Car,ArrowUpRight,ChevronDown} from 'lucide-react';
import {COLORS} from '@/lib/meet.mjs';
import {naverRouteLink} from '@/lib/naver-links.mjs';
const ICONS={walk:Footprints,subway:TrainFront,bus:BusFront,car:Car};
export default function RouteJourneys({selected,people,source}){
 return <div className="journeys"><h3>각자 이동시간</h3>{selected.routes.map((route,i)=>{
  const person=people.find(p=>p.id===route.personId)||people[i];return <details key={route.personId} className="journey"><summary><span className="journey-avatar" style={{'--person-color':COLORS[i]}}>{String.fromCharCode(65+i)}</span><span className="journey-info"><strong>{person?.name}</strong><span>{route.mode==='transit'?<>{route.walkMinutes==null?'대중교통':`도보 ${route.walkMinutes}분`}{route.transfers!==null&&route.transfers!==undefined?` · 환승 ${route.transfers}회`:''}</>:'자동차'}</span></span><strong className="journey-total">{route.minutes}<small>분</small></strong><ChevronDown size={15}/></summary><div className="journey-body"><p className="journey-origin"><i/>{person?.place.name}<small>{person?.place.address}</small></p><ol className="journey-legs">{(route.legs||[]).map((leg,index)=>{const Icon=ICONS[leg.type]||TrainFront;return <li key={index} className={`leg-${leg.type}`}><span className="leg-icon"><Icon size={15}/></span><div><strong>{leg.line||leg.label}</strong><p>{leg.from&&leg.to?`${leg.from} → ${leg.to}`:leg.to?`${leg.to}까지`:leg.from?`${leg.from}에서`:leg.label}</p></div><span className="leg-time">{leg.minutes==null?'시간 미제공':`${leg.minutes}분`}</span></li>;})}</ol><p className="journey-destination"><i/>{selected.place.name}</p><a className="naver-route-link" href={naverRouteLink(person,selected.place)}>내 경로를 네이버지도 앱에서 보기 <ArrowUpRight size={14}/></a></div></details>;
 })}</div>;
}
