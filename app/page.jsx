'use client';
import {useState,useEffect,useMemo,useRef} from 'react';
import {ArrowUpRight,ArrowRight,Plus,Info,Share2,Check,LoaderCircle,Equal,Clock3,MapPin,SlidersHorizontal} from 'lucide-react';
import {SEARCH_DEMO_PLACES,COLORS,demoResults,rankResults,validatePeople} from '@/lib/meet.mjs';
import PersonInput from '@/components/meet/PersonInput';
import AreaMap from '@/components/meet/AreaMap';
import RouteJourneys from '@/components/meet/RouteJourneys';
import {naverSearchLink} from '@/lib/naver-links.mjs';
const emptyPeople=()=>[{id:'a',name:'나',mode:'transit',place:null},{id:'b',name:'친구 1',mode:'transit',place:null}];
function glassLight(e){if(e.pointerType!=='mouse')return;const box=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--shine-x',`${((e.clientX-box.left)/box.width)*100}%`);e.currentTarget.style.setProperty('--shine-y',`${((e.clientY-box.top)/box.height)*100}%`);}
export default function Home(){
 const [people,setPeople]=useState(emptyPeople),[results,setResults]=useState([]),[source,setSource]=useState('live'),[objective,setObjective]=useState('fair'),[limit,setLimit]=useState(90),[selectedId,setSelectedId]=useState(null),[dirty,setDirty]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[filters,setFilters]=useState(false),[showMap,setShowMap]=useState(false),[config,setConfig]=useState(null),[shared,setShared]=useState(false),[meta,setMeta]=useState(null),[formVersion,setFormVersion]=useState(0);
 const resultRef=useRef(null),requestId=useRef(0),controller=useRef(null),shareTimer=useRef(null);
 useEffect(()=>{
  fetch('/api/status').then(r=>r.json()).then(setConfig).catch(()=>{});
  try{const raw=new URLSearchParams(location.search).get('plan');if(raw){const saved=JSON.parse(raw),restored=validatePeople(saved.people);setPeople(restored);setObjective(saved.objective==='fast'?'fast':'fair');setLimit(Number.isFinite(saved.limit)?Math.max(15,Math.min(120,saved.limit)):90);if(saved.source==='demo'&&restored.every(p=>SEARCH_DEMO_PLACES.some(v=>v.id===p.place.id))){setSource('demo');setDirty(false);setResults(demoResults(restored));}}}catch{setError('공유된 출발지를 불러오지 못했습니다. 다시 선택해 주세요.');}
  return ()=>{controller.current?.abort();clearTimeout(shareTimer.current);};
 },[]);
 const ranked=useMemo(()=>rankResults(results,objective,limit),[results,objective,limit]);
 const selected=ranked.find(r=>r.place.id===selectedId)||ranked[0];
 const showResults=busy||(!dirty&&results.length>0);
 function invalidate(){requestId.current++;controller.current?.abort();setBusy(false);setDirty(true);setSelectedId(null);setError('');setMeta(null);setShared(false);setShowMap(false);}
 function changePerson(index,person){const previous=people[index];if(previous.mode!==person.mode||previous.place!==person.place)invalidate();setPeople(v=>v.map((p,i)=>i===index?person:p));}
 function currentPosition(id,place){invalidate();setSource('live');setPeople(v=>v.map(p=>p.id===id?{...p,place}:source==='demo'?{...p,place:null}:p));}
 function reset(){invalidate();setPeople(emptyPeople());setSource('live');setResults([]);setObjective('fair');setLimit(90);setFilters(false);setFormVersion(v=>v+1);history.replaceState(null,'',location.pathname);}
 async function find(){
  setError('');let valid;try{valid=validatePeople(people);}catch(e){setError(e.message);return;}
  const id=++requestId.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);setShowMap(false);
  try{let data;
   if(source==='demo')data={results:demoResults(valid)};
   else{const response=await fetch('/api/meet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({people:valid}),signal:abort.signal});data=await response.json();if(!response.ok)throw new Error(data.error||'경로를 찾지 못했습니다.');}
   if(id!==requestId.current)return;setResults(data.results);setMeta(data.source==='live'?data:null);setSelectedId(null);setDirty(false);setShared(false);
   if(window.innerWidth<820)requestAnimationFrame(()=>resultRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
  }catch(e){if(e.name!=='AbortError'&&id===requestId.current){setError(e.message);setDirty(true);}}finally{if(id===requestId.current)setBusy(false);}
 }
 async function share(){
  const url=new URL(location.href);url.search='';url.searchParams.set('plan',JSON.stringify({people,source,objective,limit}));
  try{await navigator.clipboard.writeText(url.href);setShared(true);clearTimeout(shareTimer.current);shareTimer.current=setTimeout(()=>setShared(false),2500);}catch{setError('링크를 복사하지 못했습니다. 클립보드 권한을 확인해 주세요.');}
 }
 return <div className="app-shell">
  <div className="ambient" aria-hidden="true"><div className="ambient-blue"/><div className="ambient-rose"/><div className="ambient-mint"/><div className="ambient-ring"/></div>
  <main className="main-content">
   <div className={`workspace ${showResults?'has-results':''}`}>
    <section className="input-panel glass" onPointerMove={glassLight} aria-labelledby="origin-heading"><div className="panel-heading"><h2 id="origin-heading">출발지</h2><span className="people-count">{people.length}<span> / 4명</span></span></div>
     {source==='demo'?<div className="sample-notice">공유된 예시 결과입니다.<button onClick={reset}>실제 출발지 입력 <ArrowRight size={12}/></button></div>:null}
     <div className="people-list">{people.map((person,index)=><PersonInput key={`${person.id}-${formVersion}`} person={person} index={index} total={people.length} source={source} onChange={p=>changePerson(index,p)} onCurrentPosition={place=>currentPosition(person.id,place)} onRemove={()=>{invalidate();setPeople(v=>v.filter(p=>p.id!==person.id));}}/>)}</div>
     {people.length<4?<button type="button" className="add-person" onClick={()=>{invalidate();setPeople(v=>[...v,{id:`p${Date.now()}`,name:`친구 ${v.length}`,mode:'transit',place:null}]);}}><Plus size={16}/>사람 추가</button>:null}
     <div className="search-options"><div className="objective-toggle" role="group" aria-label="추천 기준"><button type="button" className={objective==='fair'?'active':''} aria-pressed={objective==='fair'} onClick={()=>{setObjective('fair');setSelectedId(null);}} title="서로의 이동시간 차이를 줄여요"><Equal size={15}/>비슷한 시간</button><button type="button" className={objective==='fast'?'active':''} aria-pressed={objective==='fast'} onClick={()=>{setObjective('fast');setSelectedId(null);}} title="가장 오래 걸리는 사람의 시간을 줄여요"><Clock3 size={14}/>빠른 만남</button></div><button type="button" className={`filter-toggle ${filters?'active':''}`} aria-label="최대 이동시간 설정" aria-expanded={filters} title="최대 이동시간" onClick={()=>setFilters(v=>!v)}><SlidersHorizontal size={17}/></button></div>
     {filters?<div className="filter-panel"><label htmlFor="max-time">한 사람당 최대 <strong>{limit}분</strong></label><input id="max-time" type="range" min="15" max="120" step="5" value={limit} onChange={e=>{setLimit(Number(e.target.value));setSelectedId(null);}}/><div><span>15분</span><span>120분</span></div></div>:null}
     {config&&!config.transit?<div className="connection-pending">대중교통 서비스 연결을 기다리고 있습니다.</div>:null}
     {error?<div className="error-box" role="alert"><Info size={15}/><span>{error}</span></div>:null}
     <button type="button" className="find-button" onClick={find} disabled={busy||people.some(p=>!p.place)}>{busy?<><LoaderCircle size={18} className="spin"/>이동시간 비교 중</>:<>만날 장소 찾기 <ArrowRight size={19}/></>}</button>
    </section>
    {showResults?<section className="results-panel glass" ref={resultRef} onPointerMove={glassLight} aria-labelledby="results-heading" aria-busy={busy}>
     <div className="panel-heading"><h2 id="results-heading">추천 장소{!busy&&ranked.length?<span className="result-count">{ranked.length}</span>:null}</h2>{!busy&&selected?<button type="button" className={`map-toggle ${showMap?'active':''}`} onClick={()=>setShowMap(v=>!v)} aria-expanded={showMap}><MapPin size={14}/>{showMap?'위치 닫기':'위치 보기'}</button>:null}</div>
     {busy?<div className="loading-state" role="status"><div className="loading-orbit"><LoaderCircle size={28} className="spin"/></div><strong>모두의 이동시간을 비교하고 있어요.</strong><span>도보와 환승까지 함께 계산합니다.</span><button type="button" onClick={()=>{invalidate();}}>취소</button></div>:!ranked.length?<div className="no-results"><Clock3 size={26}/><strong>{limit}분 안에 갈 수 있는 곳이 없어요.</strong><button onClick={()=>{setLimit(120);setFilters(true);}}>최대 120분으로 늘리기 <ArrowRight size={14}/></button></div>:<>
      {showMap?<AreaMap people={people} selected={selected} dirty={false} source={source}/>:null}
      <div className="candidate-list">{ranked.slice(0,3).map((r,index)=><button type="button" key={r.place.id} className={`candidate ${selected?.place.id===r.place.id?'chosen':''}`} aria-pressed={selected?.place.id===r.place.id} onClick={()=>setSelectedId(r.place.id)}><span className="candidate-rank">{selected?.place.id===r.place.id?<Check size={14}/>:index+1}</span><span className="candidate-content"><span className="candidate-name">{r.place.name}{index===0?<span className="best-tag">추천</span>:null}</span><span className="candidate-times">{r.routes.map((route,i)=><span key={route.personId}><i style={{background:COLORS[i]}}/><span>{people.find(p=>p.id===route.personId)?.name||`친구 ${i}`}</span><strong>{route.minutes}<small>분</small></strong></span>)}</span></span><span className="time-spread"><span>시간 차이</span><strong>{r.spread}<small>분</small></strong></span></button>)}</div>
      <RouteJourneys key={selected.place.id} selected={selected} people={people} source={source}/>
      <div className="result-actions"><a className="destination-button" href={naverSearchLink(selected.place)} target="_blank" rel="noreferrer">지도에서 보기 <ArrowUpRight size={16}/></a><button type="button" className={`share-button ${shared?'copied':''}`} onClick={share}>{shared?<Check size={15}/>:<Share2 size={15}/>} {shared?'복사했어요':'친구에게 공유'}</button></div>
      <p className="result-note">도보·환승 포함{meta?.queriedAt?` · ${new Date(meta.queriedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 조회`:source==='demo'?' · 예시 시간':''}</p>
     </>}
    </section>:null}
   </div>
  </main>
 </div>;
}
