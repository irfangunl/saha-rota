'use strict';
const $=id=>document.getElementById(id);
const plans=$('plans'),tabs=$('tabs'),list=$('list'),dock=$('dock'),nextbtn=$('nextbtn'),reset=$('reset'),fitall=$('fitall'),locate=$('locate');
const D=window.TRAFO_DATA;
const COL=['--c0','--c1','--c2'].map(v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim());
const ls={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let st={plan:ls.get('plan',0),tab:ls.get('tab',0)};
let done=ls.get('done',{});
const nav=(la,lo)=>`https://www.google.com/maps/dir/?api=1&destination=${la},${lo}&travelmode=driving&dir_action=navigate`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const key=c=>st.plan+':'+c;

const map=L.map('map',{zoomControl:false});
L.control.zoom({position:'topleft'}).addTo(map);
const street=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'});
const sat=L.layerGroup([L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'}),L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,opacity:.8}),L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19})]).addTo(map);
L.control.layers({'Uydu':sat,'Harita':street},null,{position:'topright'}).addTo(map);
let layer=L.layerGroup().addTo(map),markers={},meMarker=null;
const pin=(cls,txt)=>L.divIcon({className:'',html:`<div class="pin ${cls}">${txt}</div>`,iconSize:[26,26],iconAnchor:[13,13]});

function renderTabs(){
  plans.innerHTML=D.plans.map((p,i)=>`<button class="${i==st.plan?'on':''}" data-p="${i}">${esc(p.title)}</button>`).join('');
  const P=D.plans[st.plan];
  const tabs_=P.teams.map((t,i)=>`<button class="${i==st.tab?'on':''}" data-t="${i}"><span class="dot k${i}"></span>Ekip ${i+1}</button>`);
  tabs_.push(`<button class="${st.tab==9?'on':''}" data-t="9">Diğer</button>`);
  tabs.innerHTML=tabs_.join('');
}
plans.onclick=e=>{const b=e.target.closest('button');if(!b)return;st.plan=+b.dataset.p;if(st.tab!=9&&st.tab>=D.plans[st.plan].teams.length)st.tab=0;ls.set('plan',st.plan);render(true)};
tabs.onclick=e=>{const b=e.target.closest('button');if(!b)return;st.tab=+b.dataset.t;ls.set('tab',st.tab);render(true)};

function render(fit){
  renderTabs();
  const P=D.plans[st.plan];
  document.documentElement.style.setProperty('--tc',st.tab==9?'#667085':COL[st.tab]);
  layer.clearLayers();markers={};
  L.marker(D.depot,{icon:pin('pdepot','Ç')}).bindPopup('Çıkış / dönüş noktası').addTo(layer);
  P.teams.forEach((t,i)=>{
    const active=st.tab==i;
    L.polyline(t.line,{color:'#fff',weight:active?8:5,opacity:active?.9:.5}).addTo(layer);
    L.polyline(t.line,{color:COL[i],weight:active?5:3,opacity:active?.95:.35}).addTo(layer);
  });
  P.teams.forEach((t,i)=>t.stops.forEach(s=>{
    const active=st.tab==i,isDone=done[key(s.c)];
    const m=L.marker([s.la,s.lo],{icon:pin(isDone?'pdone':'k'+i,isDone?'✓':s.n),opacity:active?1:.45,zIndexOffset:active?1000:0})
      .bindPopup(`<b>${esc(s.c)}</b> · Ekip ${i+1} / ${s.n}<br>${esc(s.mh)}${s.y?' – '+esc(s.y):''}<br>${esc(s.d)}<br><a href="${nav(s.la,s.lo)}" target="_blank">Yol tarifi →</a>`).addTo(layer);
    if(active)markers[s.c]=m;
  }));
  const grey=(arr,c)=>arr.forEach(s=>{const m=L.marker([s.la,s.lo],{icon:pin(c,''),opacity:st.tab==9?1:.6})
    .bindPopup(`<b>${esc(s.c)}</b><br>${esc(s.mh)}${s.y?' – '+esc(s.y):''}<br>${esc(s.w||s.d)}<br><a href="${nav(s.la,s.lo)}" target="_blank">Yol tarifi →</a>`).addTo(layer);if(st.tab==9)markers[s.c]=m;});
  grey(P.yedek,'pyedek');grey(D.haric,'pharic');

  let html='',sum='',next=null;
  if(st.tab==9){
    const li=a=>a.map(s=>`<li><b>${esc(s.c)}</b> – ${esc(s.il)} / ${esc(s.mh)} <span class="sub">${esc(s.w||s.a)}</span> · <a href="${nav(s.la,s.lo)}" target="_blank">yol tarifi</a></li>`).join('');
    if(P.yedek.length)html+=`<div class="sec"><h3>Yedek – vakit kalırsa (${P.yedek.length+1})</h3><div class="sub">Güne sığmayanlar.</div><ul>${li(P.yedek)}<li><b>TBK738</b> – Yüreğir / Kışla <span class="sub">konumu bilinmiyor</span></li></ul></div>`;
    if(D.haric.length)html+=`<div class="sec"><h3>Plana alınmayanlar (${D.haric.length})</h3><div class="sub">Uzak / tek kalan noktalar. Karaisalı'daki 6 trafo ayrı bir gün.</div><ul>${li(D.haric)}</ul></div>`;
    sum=`<span>${esc(P.title)} · plan dışı trafolar</span>`;
  }else{
    const t=P.teams[st.tab];const n=t.stops.filter(s=>done[key(s.c)]).length;
    next=t.stops.find(s=>!done[key(s.c)]);
    sum=`<span><b>${t.stops.length}</b> trafo</span><span>~${t.km} km</span><span><b>${n}/${t.stops.length}</b> tamam</span><div class="bar"><i id="barfill"></i></div>`;
    t.stops.forEach(s=>{
      const isDone=!!done[key(s.c)];
      html+=`<div class="card ${isDone?'done':''} ${next&&next.c==s.c?'next':''}" id="c-${s.c}">
        <div class="num">${isDone?'✓':s.n}</div>
        <div><div class="head"><span class="code">${esc(s.c)}</span></div>
          <div class="place">${esc(s.il)} / ${esc(s.mh)}</div>${s.y?`<div class="sub">${esc(s.y)}</div>`:''}
          <span class="tag">${esc(s.d)}</span></div>
        <div class="acts"><a class="go" href="${nav(s.la,s.lo)}" target="_blank" rel="noopener">➤ Yol tarifi</a>
          <button data-show="${s.c}">Haritada</button>
          <button class="ok ${isDone?'on':''}" data-done="${s.c}">${isDone?'✓ Tamam':'Tamam'}</button></div></div>`;
    });
  }
  list.innerHTML=html;document.getElementById('sum').innerHTML=sum;
  const bf=document.getElementById('barfill');if(bf&&st.tab!=9){const t=P.teams[st.tab];bf.style.width=(100*t.stops.filter(s=>done[key(s.c)]).length/t.stops.length)+'%';}
  if(next){dock.classList.remove('hide');nextbtn.href=nav(next.la,next.lo);nextbtn.innerHTML=`➤ Sıradaki: ${next.n}. ${esc(next.c)} <small>${esc(next.mh)}</small>`}
  else{dock.classList.add('hide')}
  if(fit){window.scrollTo(0,0);fitView();}
}
function fitView(){
  const P=D.plans[st.plan];let pts=[D.depot];
  if(st.tab==9)pts=pts.concat(P.yedek.map(s=>[s.la,s.lo]));else pts=pts.concat(P.teams[st.tab].stops.map(s=>[s.la,s.lo]));
  map.invalidateSize();map.fitBounds(L.latLngBounds(pts),{padding:[24,24]});
}
list.onclick=e=>{
  const sh=e.target.closest('[data-show]'),dn=e.target.closest('[data-done]');
  if(sh){const m=markers[sh.dataset.show];if(m){map.setView(m.getLatLng(),16);m.openPopup();window.scrollTo({top:0,behavior:'smooth'})}}
  if(dn){const k=key(dn.dataset.done);if(done[k])delete done[k];else done[k]=Date.now();ls.set('done',done);render(false)}
};
reset.onclick=()=>{if(confirm('Bu cihazdaki tüm "Tamam" işaretleri silinsin mi?')){done={};ls.set('done',done);render(false)}};
fitall.onclick=fitView;
locate.onclick=()=>{
  if(!navigator.geolocation){alert('Konum desteklenmiyor');return}
  navigator.geolocation.getCurrentPosition(p=>{
    const ll=[p.coords.latitude,p.coords.longitude];
    if(meMarker)meMarker.setLatLng(ll);else meMarker=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:[16,16],iconAnchor:[8,8]}),zIndexOffset:2000}).addTo(map);
    map.setView(ll,15);
  },()=>alert('Konum alınamadı. Tarayıcıda konum iznini açın.'),{enableHighAccuracy:true,timeout:10000});
};
window.addEventListener('resize',()=>map.invalidateSize());
try{if(document.featurePolicy&&!document.featurePolicy.allowsFeature('geolocation'))locate.style.display='none'}catch(e){}
render(true);setTimeout(fitView,300);
