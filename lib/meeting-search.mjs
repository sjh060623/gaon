import {distance,rankResults} from './meet.mjs';

const blend=(a,b,fraction=.5)=>({lng:a.lng+(b.lng-a.lng)*fraction,lat:a.lat+(b.lat-a.lat)*fraction});
const nearest=(places,point)=>[...places].sort((a,b)=>distance(point,a)-distance(point,b))[0];
function distinctPoints(points,minKm=.6){
 const unique=[];
 for(const point of points)if(!unique.some(p=>distance(p,point)<minKm))unique.push(point);
 return unique;
}
export function seedSearchPoints(people){
 const origins=people.map(p=>p.place),center={lng:origins.reduce((n,p)=>n+p.lng,0)/origins.length,lat:origins.reduce((n,p)=>n+p.lat,0)/origins.length};
 const pairs=[];for(let i=0;i<origins.length;i++)for(let j=i+1;j<origins.length;j++)pairs.push(blend(origins[i],origins[j]));
 return {center,points:distinctPoints([center,...origins,...origins.map(p=>blend(center,p)),...pairs]).slice(0,12)};
}
// Choose candidates near separate target points before filling geographic gaps.
export function diverseCandidates(places,targets,count,center){
 const available=[...places],chosen=[];
 for(const point of targets){
  const match=nearest(available.filter(p=>!chosen.some(v=>v.id===p.id||distance(v,p)<.5)),point);
  if(match)chosen.push(match);if(chosen.length>=count)return chosen;
 }
 while(chosen.length<count){
  const remaining=available.filter(p=>!chosen.some(v=>v.id===p.id));if(!remaining.length)break;
  const next=chosen.length?remaining.sort((a,b)=>Math.min(...chosen.map(v=>distance(b,v)))-Math.min(...chosen.map(v=>distance(a,v))))[0]:nearest(remaining,center);
  chosen.push(next);
 }
 return chosen;
}
export function refinementPoints(people,result,round,spanKm){
 const center=result.place,times=result.routes.map(r=>r.minutes),mean=times.reduce((a,b)=>a+b,0)/times.length;
 let dx=0,dy=0,weight=0;const slower=[];
 result.routes.forEach(route=>{
  const origin=people.find(p=>p.id===route.personId)?.place;if(!origin)return;
  const excess=route.minutes-mean;dx+=excess*(origin.lng-center.lng);dy+=excess*(origin.lat-center.lat);weight+=Math.abs(excess);
  if(excess>0)slower.push(blend(center,origin,Math.min(.65,Math.max(.15,excess/route.minutes))));
 });
 const step=Math.max(.6,Math.min(10,spanKm*.24)/(2**round)),lngStep=step/(111*Math.cos(center.lat*Math.PI/180)),latStep=step/111;
 const length=Math.hypot(dx/lngStep,dy/latStep),directed=weight&&length?{lng:center.lng+dx/length,lat:center.lat+dy/length}:center;
 return distinctPoints([directed,...slower,{lng:center.lng-lngStep,lat:center.lat},{lng:center.lng+lngStep,lat:center.lat},{lng:center.lng,lat:center.lat-latStep},{lng:center.lng,lat:center.lat+latStep}],.25);
}

export async function searchBalancedPlaces(people,{searchPlaces,route,signal,limit=90}){
 const {center,points}=seedSearchPoints(people),spanKm=Math.max(3,...people.map(p=>distance(center,p.place)*2));
 const pool=new Map(),examined=new Set(),pending=new Map(),placeSearches=new Map(),results=[];let excluded=0,routeCalls=0,searchRounds=0,active=0,fatalError;
 const waiting=[],abort=new AbortController(),overall=AbortSignal.any([abort.signal,AbortSignal.timeout(55000),...(signal?[signal]:[])]);
 const expired=()=>{if(signal?.aborted)throw new Error('요청이 취소되었습니다.');return overall.aborted;};
 async function discover(targets){
  for(let index=0;index<targets.length;index+=4){
   if(expired())break;
   const sets=await Promise.allSettled(targets.slice(index,index+4).map(point=>{
    const key=`${point.lng.toFixed(3)},${point.lat.toFixed(3)}`;
    if(!placeSearches.has(key))placeSearches.set(key,searchPlaces('역',{x:String(point.lng),y:String(point.lat),radius:'20000',sort:'distance',category_group_code:'SW8'},overall));
    return placeSearches.get(key);
   }));
   for(const set of sets){
    if(set.status==='rejected'){if(set.reason?.fatal)throw set.reason;continue;}
    for(const place of set.value)if(Number.isFinite(place.lng)&&Number.isFinite(place.lat)&&!pool.has(place.id)&&!Array.from(pool.values()).some(p=>distance(p,place)<.25))pool.set(place.id,place);
   }
  }
 }
 async function limitedRoute(person,place){
  if(active>=8)await new Promise(resolve=>waiting.push(resolve));
  if(overall.aborted){waiting.shift()?.();throw fatalError||new Error('검색 시간이 초과되었습니다.');}
  active++;
  try{routeCalls++;return await route(person,place,overall);}catch(error){if(error.fatal){fatalError=error;abort.abort();}throw error;}finally{active--;waiting.shift()?.();}
 }
 async function getRoute(person,place){
  const key=[person.mode,person.place.lng,person.place.lat,place.lng,place.lat].join(':');
  if(!pending.has(key))pending.set(key,limitedRoute(person,place));
  return {...await pending.get(key),personId:person.id};
 }
 async function evaluate(candidates){
  if(!candidates.length||expired())return;searchRounds++;
  await Promise.all(candidates.map(async place=>{
   examined.add(place.id);
   const routes=await Promise.allSettled(people.map(person=>getRoute(person,place)));
   if(routes.every(r=>r.status==='fulfilled'))results.push({place,routes:routes.map(r=>r.value)});else excluded++;
  }));
  if(fatalError)throw fatalError;
 }
 await discover(points);
 if(!pool.size)throw new Error('주변에서 만남 후보 역을 찾지 못했습니다.');
 await evaluate(diverseCandidates(pool.values(),points,8,center));
 for(let round=0;round<3&&examined.size<24&&!expired();round++){
  const ranked=rankResults(results,'fair',limit),best=ranked[0]||rankResults(results,'fair',Infinity)[0];
  if(ranked[0]?.spread===0)break;
  const targets=best?refinementPoints(people,best,round,spanKm):points;
  await discover(targets);
  const remaining=Array.from(pool.values()).filter(p=>!examined.has(p.id));
  // Keep looking in other regions even if the nearest candidates had no routes.
  const candidates=diverseCandidates(remaining,targets,Math.min(round===0?6:5,24-examined.size),best?.place||center);
  if(!candidates.length)break;
  await evaluate(candidates);
 }
 if(signal?.aborted)throw new Error('요청이 취소되었습니다.');
 if(!results.length)throw new Error('모든 참가자의 전체 경로를 확보하지 못했습니다. 출발지와 API 연결을 확인해 주세요.');
 return {results,excluded,candidateCount:examined.size,discoveredCandidates:pool.size,routeCalls,searchRounds,searchTruncated:overall.aborted||examined.size>=24};
}
