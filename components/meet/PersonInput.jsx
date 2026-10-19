'use client';
import {useEffect,useState,useRef} from 'react';
import {Search,TrainFront,Car,X,MapPin,LoaderCircle,LocateFixed} from 'lucide-react';
import {SEARCH_DEMO_PLACES,COLORS} from '@/lib/meet.mjs';
const normalize=s=>s.replaceAll('경기도','경기').replaceAll('서울특별시','서울').replaceAll('인천광역시','인천').replace(/\s/g,'').toLowerCase();
export default function PersonInput({person,index,total,onChange,onRemove,onCurrentPosition,source}){
 const [query,setQuery]=useState(person.place?.name||''),[open,setOpen]=useState(false),[suggestions,setSuggestions]=useState([]),[loading,setLoading]=useState(false),[locating,setLocating]=useState(false),[error,setError]=useState(''),[geoError,setGeoError]=useState(''),[active,setActive]=useState(0);const generation=useRef(0),inputRef=useRef(null);
 useEffect(()=>{if(person.place)setQuery(person.place.name);},[person.place]);
 useEffect(()=>()=>{generation.current++;},[]);
 useEffect(()=>{
  if(!open)return;const abort=new AbortController();const timer=setTimeout(async()=>{
   setError('');setActive(0);setLoading(false);
   if(source==='demo'){const q=normalize(query.trim());setSuggestions(SEARCH_DEMO_PLACES.filter(p=>normalize(p.name+p.address+p.area).includes(q)).slice(0,8));return;}
   if(query.trim().length<2){setSuggestions([]);return;}
   setLoading(true);try{const response=await fetch(`/api/places?q=${encodeURIComponent(query)}`,{signal:abort.signal});const data=await response.json();if(!response.ok)throw new Error(data.error);if(abort.signal.aborted)return;setSuggestions(data.places);if(data.warnings?.length)setError(data.warnings[0]);}catch(e){if(e.name!=='AbortError'){setSuggestions([]);setError(e.message);}}finally{if(!abort.signal.aborted)setLoading(false);}
  },source==='demo'?0:350);return ()=>{clearTimeout(timer);abort.abort();};
 },[query,open,source]);
 function select(place){generation.current++;setLocating(false);setGeoError('');setQuery(place.name);onChange({...person,place});setOpen(false);}
 function clear(){generation.current++;setLocating(false);setQuery('');setSuggestions([]);setGeoError('');onChange({...person,place:null});setOpen(true);inputRef.current?.focus();}
 async function currentPosition(){
  setGeoError('');setOpen(false);if(!navigator.geolocation){setGeoError('현재 위치를 지원하지 않는 브라우저입니다. 주소로 검색해 주세요.');return;}
  const request=++generation.current;setLocating(true);
  try{
   const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:60000}));
   if(request!==generation.current)return;const {longitude:lng,latitude:lat,accuracy}=pos.coords;
   if(lat<33||lat>39||lng<124||lng>132)throw new Error('대한민국 내 위치만 지원합니다.');
   let address=`위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`;
   try{const r=await fetch(`/api/reverse?lng=${lng}&lat=${lat}`,{signal:AbortSignal.timeout(5000)});if(r.ok){const data=await r.json();address=data.address||address;}}catch{}
   if(request!==generation.current)return;const place={id:`gps:${lng},${lat}`,name:'현재 위치',address,lng,lat,kind:'current',accuracy:Math.round(accuracy)};setQuery(place.name);onCurrentPosition(place);
  }catch(e){if(request===generation.current)setGeoError(e.code===1?'위치 권한을 허용하거나 주소로 검색해 주세요.':e.code===3?'현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.':e.message||'현재 위치를 확인하지 못했습니다.');}finally{if(request===generation.current)setLocating(false);}
 }
 const listId=`places-${person.id}`;
 return <div className={`person-card ${open?'is-open':''}`} style={{'--person-color':COLORS[index]}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
  <div className="person-top"><span className="person-letter">{String.fromCharCode(65+index)}</span><label className="person-name"><span className="sr-only">{index+1}번째 참가자 이름</span><input value={person.name} maxLength={15} placeholder={`친구 ${index}`} onChange={e=>onChange({...person,name:e.target.value})}/></label><div className="transport-toggle" role="group" aria-label={`${person.name} 이동수단`}><button type="button" className={person.mode==='transit'?'active':''} aria-pressed={person.mode==='transit'} onClick={()=>onChange({...person,mode:'transit'})}><TrainFront size={13}/>대중교통</button><button type="button" className={person.mode==='car'?'active':''} aria-pressed={person.mode==='car'} onClick={()=>onChange({...person,mode:'car'})}><Car size={13}/>자동차</button></div>{total>2?<button type="button" className="remove-person" aria-label={`${person.name||'참가자'} 삭제`} onClick={onRemove}><X size={14}/></button>:null}</div>
  <div className={`place-field ${open?'focused':''}`}><Search size={17}/><input ref={inputRef} role="combobox" aria-label={`${person.name||index+1} 출발지 검색`} aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open&&suggestions[active]?`${listId}-${active}`:undefined} placeholder="주소 또는 장소 검색" value={query} onFocus={()=>setOpen(true)} onChange={e=>{generation.current++;setLocating(false);setQuery(e.target.value);setSuggestions([]);onChange({...person,place:null});setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(v=>Math.max(0,Math.min(suggestions.length-1,v+1)));}if(e.key==='ArrowUp'){e.preventDefault();setActive(v=>Math.max(0,v-1));}if(e.key==='Enter'&&open){e.preventDefault();if(suggestions[active])select(suggestions[active]);}}}/>{query?<button type="button" className="clear-place" aria-label={`${person.name} 출발지 지우기`} onClick={clear}><X size={13}/></button>:null}<button type="button" className={`locate-button ${locating?'locating':''}`} onClick={currentPosition} disabled={locating} aria-label={`${person.name} 현재 위치 사용`} title="현재 위치 사용">{locating?<LoaderCircle size={17} className="spin"/>:<LocateFixed size={17}/>}</button></div>
  {person.place?.address?<p className="selected-address" title={person.place.address}>{person.place.address}</p>:null}
  {geoError?<p className="geo-error" role="alert">{geoError}</p>:null}
  {open?<div className="suggestion-popover"><ul role="listbox" id={listId}>{loading?<li className="search-message"><LoaderCircle size={15} className="spin"/>검색 중</li>:suggestions.map((p,i)=><li key={p.id} role="option" id={`${listId}-${i}`} aria-selected={active===i}><button type="button" className={active===i?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>select(p)}><MapPin size={17}/><span><strong>{p.name}</strong><small>{p.address}</small></span></button></li>)}</ul>{!loading&&(!suggestions.length||error)?<div className="search-message">{error||(query.trim().length<2?'주소나 장소를 두 글자 이상 입력해 주세요.':'검색 결과가 없습니다.')}</div>:null}</div>:null}
 </div>;
}
