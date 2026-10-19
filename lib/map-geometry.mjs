// All serialized map coordinates use [longitude, latitude].
export function validCoordinate(point){
 return Array.isArray(point)&&point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&point[0]>=124&&point[0]<=132&&point[1]>=33&&point[1]<=39;
}
export function compactPath(points,maxPoints=700){
 if(!Array.isArray(points))return [];
 const clean=points.filter(validCoordinate).map(p=>[p[0],p[1]]).filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);
 if(clean.length<=maxPoints)return clean;
 return Array.from({length:maxPoints},(_,i)=>clean[Math.round(i*(clean.length-1)/(maxPoints-1))]);
}
export function routeMapSegments(route,origin,destination){
 const available=(route?.mapSegments||[]).map(s=>({...s,path:compactPath(s.path)})).filter(s=>s.path.length>1);
 if(available.length){
  const first=available[0].path[0],last=available.at(-1).path.at(-1);
  if(Math.hypot(first[0]-origin.lng,first[1]-origin.lat)>.0001)available.unshift({type:'connection',approximate:true,path:[[origin.lng,origin.lat],first]});
  if(Math.hypot(last[0]-destination.lng,last[1]-destination.lat)>.0001)available.push({type:'connection',approximate:true,path:[last,[destination.lng,destination.lat]]});
  return available;
 }
 const path=compactPath([[origin.lng,origin.lat],[destination.lng,destination.lat]]);
 return path.length>1?[{type:'connection',approximate:true,path}]:[];
}
