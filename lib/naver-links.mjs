export function naverRouteLink(person,destination,appname=typeof window==='undefined'?'gaon':window.location.origin){
 const q=new URLSearchParams({slat:String(person.place.lat),slng:String(person.place.lng),sname:person.place.name,dlat:String(destination.lat),dlng:String(destination.lng),dname:destination.name,appname});
 return `nmap://route/${person.mode==='car'?'car':'public'}?${q}`;
}
export function naverSearchLink(place){return `https://map.naver.com/p/search/${encodeURIComponent(place.address?`${place.name} ${place.address}`:place.name)}`;}
