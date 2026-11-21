import{c as v}from"./index-COFkIyov.js";import{c as y}from"./state-vendor-BzY07FRg.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["path",{d:"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5",key:"mvr1a0"}]],p=v("heart",l),n="ka-card:favorite-products:v1",m=()=>{try{const t=JSON.parse(localStorage.getItem(n)||"{}");return!t||typeof t!="object"||Array.isArray(t)?{}:Object.fromEntries(Object.entries(t).map(([r,e])=>[r,Array.isArray(e)?[...new Set(e.map(String).filter(Boolean))]:[]]))}catch{return{}}},d=t=>{try{localStorage.setItem(n,JSON.stringify(t))}catch{}},A=t=>String((t==null?void 0:t.id)||(t==null?void 0:t._id)||(t==null?void 0:t.userId)||"guest"),B=y(t=>({favoritesByUser:m(),toggleFavorite:(r,e)=>t(a=>{const o=String(e||"").trim();if(!o)return a;const c=a.favoritesByUser[r]||[],s=c.includes(o)?c.filter(f=>f!==o):[...c,o],i={...a.favoritesByUser,[r]:s};return d(i),{favoritesByUser:i}})}));export{p as H,A as f,B as u};
