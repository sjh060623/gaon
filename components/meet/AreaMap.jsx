'use client';
import {useEffect,useRef,useState} from 'react';
import {LocateFixed,LoaderCircle,MapPin} from 'lucide-react';
import {COLORS} from '@/lib/meet.mjs';
import {routeMapSegments} from '@/lib/map-geometry.mjs';

function popup(title,description){
 const root=document.createElement('div');root.className='meet-popup';
 const heading=document.createElement('strong');heading.textContent=title;root.append(heading);
 if(description){const text=document.createElement('p');text.textContent=description;root.append(text);}
 return root;
}
function pin(L,label,color,destination=false){
 const node=document.createElement('span');node.className=`meet-pin ${destination?'is-destination':''}`;node.style.setProperty('--pin-color',color);node.textContent=label;
 return L.divIcon({className:'meet-marker',html:node,iconSize:[34,42],iconAnchor:[17,42],popupAnchor:[0,-40]});
}
export default function AreaMap({people,selected,results,onSelect}){
 const container=useRef(null),map=useRef(null),layers=useRef(null),library=useRef(null),bounds=useRef(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(false),[tileError,setTileError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false,observer;
  setError(false);setTileError(false);setReady(false);
  import('leaflet').then(module=>{
   if(cancelled||!container.current)return;
   const L=module.default||module;library.current=L;
   const instance=L.map(container.current,{center:[37.5,127],zoom:10,scrollWheelZoom:false,zoomControl:false,attributionControl:true});map.current=instance;
   instance.attributionControl.setPrefix(false);
   L.control.zoom({position:'bottomright',zoomInTitle:'지도 확대',zoomOutTitle:'지도 축소'}).addTo(instance);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',referrerPolicy:'strict-origin-when-cross-origin'}).on('tileerror',()=>{if(!cancelled)setTileError(true);}).on('tileload',()=>{if(!cancelled)setTileError(false);}).addTo(instance);
   layers.current=L.layerGroup().addTo(instance);
   observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer.observe(container.current);
   setReady(true);
  }).catch(()=>{if(!cancelled)setError(true);});
  return ()=>{cancelled=true;observer?.disconnect();map.current?.remove();map.current=null;layers.current=null;};
 },[retry]);
 useEffect(()=>{
  if(!ready||!map.current||!selected)return;
  const L=library.current,group=layers.current;group.clearLayers();
  const points=[];
  people.forEach((person,index)=>{
   if(!person.place)return;
   const origin=person.place,route=selected.routes.find(r=>r.personId===person.id),color=COLORS[index];
   const start=[origin.lat,origin.lng];points.push(start);
   routeMapSegments(route,origin,selected.place).forEach(segment=>{
    const coords=segment.path.map(([lng,lat])=>[lat,lng]);points.push(...coords);
    L.polyline(coords,{color,weight:segment.type==='walk'?3:4,opacity:.8,dashArray:segment.type==='walk'||segment.approximate?'5 7':undefined,lineCap:'round'}).bindPopup(popup(person.name,segment.approximate?'출발지와 목적지를 연결한 위치 참고선':segment.type==='walk'?'도보 구간':route?.summary)).addTo(group);
   });
   const title=`${String.fromCharCode(65+index)} · ${person.name}`;
   L.marker(start,{icon:pin(L,String.fromCharCode(65+index),color),title,alt:title,keyboard:true,zIndexOffset:500}).bindPopup(popup(`${title}${route?` · ${route.minutes}분`:''}`,`${origin.name}${origin.address?` · ${origin.address}`:''}`)).addTo(group);
  });
  results.slice(0,3).forEach((result,index)=>{
   const active=result.place.id===selected.place.id,position=[result.place.lat,result.place.lng];points.push(position);
   const marker=L.marker(position,{icon:pin(L,active?'✓':String(index+1),active?'#087cff':'#60748d',true),title:`${index+1}위 ${result.place.name}`,alt:`추천 장소 ${result.place.name}`,zIndexOffset:active?1000:0,keyboard:true}).addTo(group);
   marker.bindTooltip(popup(`${index+1}. ${result.place.name}`),{direction:'top',offset:[0,-43],permanent:active,className:'destination-tooltip'});
   marker.on('click',()=>onSelect(result.place.id));
   marker.bindPopup(popup(result.place.name,result.place.address));
  });
  bounds.current=L.latLngBounds(points);map.current.invalidateSize({pan:false});map.current.fitBounds(bounds.current,{padding:[35,55],maxZoom:15,animate:false});
 },[ready,people,selected,results,onSelect]);
 return <section className="meeting-map" aria-label="출발지와 추천 장소 지도">
  <div className="meeting-map-header"><span><MapPin size={14}/>{selected.place.name}</span><button type="button" onClick={()=>{if(map.current&&bounds.current)map.current.fitBounds(bounds.current,{padding:[35,55],maxZoom:15});}} disabled={!ready} aria-label="출발지와 추천 장소 모두 보기"><LocateFixed size={15}/>전체 보기</button></div>
  <div className="meeting-map-frame"><div ref={container} className="meeting-map-canvas" aria-label="확대·축소하거나 이동해 출발지와 추천 장소를 확인하세요"/>{!ready?<div className="meeting-map-loading" role="status">{error?<><span>지도를 불러오지 못했습니다.</span><button type="button" onClick={()=>setRetry(v=>v+1)}>다시 시도</button></>:<><LoaderCircle size={22} className="spin"/><span>지도 불러오는 중</span></>}</div>:null}{tileError?<p className="map-tile-error" role="status">지도 배경 연결을 확인해 주세요.</p>:null}</div>
  <div className="meeting-map-legend">{people.map((person,index)=><span key={person.id}><i style={{background:COLORS[index]}}/>{String.fromCharCode(65+index)} · {person.name}</span>)}<span><i className="destination-dot"/>만날 곳</span></div>
  <p className="meeting-map-note">실선은 조회 경로, 점선은 도보 또는 출발·도착 위치 연결선입니다. 실제 안내와 다를 수 있습니다.</p>
 </section>;
}
