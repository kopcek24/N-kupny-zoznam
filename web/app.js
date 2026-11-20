import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithCustomToken, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fbApp = initializeApp(firebaseConfig);
const FB = { auth:getAuth(fbApp), provider:new GoogleAuthProvider(),
  db:initializeFirestore(fbApp,{localCache:persistentLocalCache()}),
  signInWithPopup, signInWithRedirect, signInWithCustomToken, getRedirectResult, onAuthStateChanged, signOut,
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, arrayUnion, arrayRemove };
FB.provider.setCustomParameters({prompt:"select_account"});
import { LOGO } from "./logos.js";

const LOGO_BG = {lidl:"#0050aa", kaufland:"#e3000f", d101:"#2ec4b6"};
const imgLogo = k => `<span class="logo lg-img"${LOGO_BG[k]?` style="background:${LOGO_BG[k]};border-color:${LOGO_BG[k]}"`:""}><img src="${LOGO[k]}" alt=""></span>`;
const STORES = {
  tesco:   {name:"Tesco",    logo:imgLogo('tesco')},
  lidl:    {name:"Lidl",     logo:imgLogo('lidl')},
  kaufland:{name:"Kaufland", logo:imgLogo('kaufland')},
  billa:   {name:"Billa",    logo:'<span class="logo lg-billa">BILLA</span>'},
  coop:    {name:"COOP Jednota", logo:imgLogo('coop')},
  fresh:   {name:"Fresh",    logo:imgLogo('fresh')},
  milkagro:{name:"Milk-Agro",logo:imgLogo('milkagro')},
  klas:    {name:"Klas",     logo:'<span class="logo lg-klas">Klas</span>'},
  dm:      {name:"dm",       logo:imgLogo('dm')},
  teta:    {name:"Teta",     logo:imgLogo('teta')},
  d101:    {name:"101 drogérie", logo:imgLogo('d101')},
  drmax:   {name:"Dr. Max",  logo:imgLogo('drmax')},
  benu:    {name:"BENU",     logo:'<span class="logo lg-benu">BENU</span>'},
  alza:    {name:"Alza",     logo:'<span class="logo lg-alza">alza</span>'},
  planeo:  {name:"Planeo",   logo:imgLogo('planeo')},
  nay:     {name:"Nay",      logo:imgLogo('nay')},
};
const MAIN = ["tesco","lidl","kaufland","billa"];
/* Predvolené odkazy (overené 18. 11. 2026). Prehľadané letáky sú v db: katalog/<obchod>
   = {current:{url,from,to}, next:{url,from,to}|null, items:[{n,s,p,op,u,c,f,t,l}], updated} */
const LEAFLETS = {
  tesco:{current:{url:"https://www.tesco.sk/akciove-ponuky/letaky-a-katalogy",from:"2026-11-18",to:"2026-11-24"}},
  lidl:{current:{url:"https://www.lidl.sk/c/online-letak/s10008489",from:"2026-11-16",to:"2026-11-22"},
        extra:[{label:"Ponuka od pondelka",url:"https://www.lidl.sk/c/store/ponuka-od-pondelka/a10102636"},{label:"Ponuka od štvrtka",url:"https://www.lidl.sk/c/ponuka-od-stvrtka/a10102663"}],
        hint:"Leták od pondelka Lidl zverejňuje cez víkend na tej istej stránke."},
  kaufland:{current:{url:"https://predajne.kaufland.sk/aktualna-ponuka/letak.html",from:"2026-11-12",to:"2026-11-18"},
            next:{url:"https://predajne.kaufland.sk/aktualna-ponuka/buduci-tyzden.html",from:"2026-11-19",to:"2026-11-25"}},
  billa:{current:{url:"https://www.billa.sk/letaky-a-akcie/aktualny-letak",from:"2026-11-18",to:"2026-11-24"},
         extra:[{label:"BILLA Bonus leták",url:"https://www.billa.sk/letaky-a-akcie/billa-bonus-letak"},{label:"Všetky letáky",url:"https://www.billa.sk/letaky-a-akcie/letaky"}]},
  coop:{current:{url:"https://www.coop.sk/letaky"}, hint:"Na stránke si vyber svoju predajňu, letáky sú aj regionálne."},
  fresh:{current:{url:"https://ifresh.sk/newsletters"}, hint:"Fresh má regionálne letáky."},
  milkagro:{current:{url:"https://www.milkagro.sk/sk/letak-a-akcie"}},
  klas:{web:true, current:{url:"https://www.klas.sk/"}, hint:"Odkaz vedie na web Klas."},
  dm:{web:true, current:{url:"https://www.mojadm.sk/"}, hint:"dm nemá klasický leták, akcie sú na webe a v aplikácii Moja dm."},
  teta:{current:{url:"https://www.tetadrogerie.sk/akcie.html"}, extra:[{label:"Leták online",url:"https://letak.tetadrogerie.sk/customer"}]},
  d101:{current:{url:"https://101drogerie.sk/letaky"}},
  drmax:{current:{url:"https://www.drmax.sk/akciovy-letak"}, extra:[{label:"Letákové akcie",url:"https://www.drmax.sk/akcie-a-zlavy/letakove-akcie"}]},
  benu:{current:{url:"https://www.benulekaren.sk/benu-akciovy-letak"}},
  alza:{web:true, current:{url:"https://www.alza.sk/"}, hint:"Alza nemá leták, akcie sú priamo na webe."},
  planeo:{current:{url:"https://www.planeo.sk/letaky"}},
  nay:{web:true, current:{url:"https://www.nay.sk/"}, hint:"Nay nemá klasický leták, akcie sú priamo na webe."},
};
function lsGet(k){ try{ return JSON.parse(localStorage.getItem("nakupy:"+k)||"null"); }catch(e){ return null; } }

const state = {zoznam:[], oblubene:[], kupony:[], katalog:{}, tab:"zoznam", db:null, user:null, me:null, hh:null, households:[], names:{}, sem:{}, pending:new Set(), open:new Set(), shop:(lsGet("shop")||"all")};
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const todayISO = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const fmtD = iso => { if(!iso) return ""; const [y,m,d]=iso.split("-"); return (+d)+". "+(+m)+"."; };
const eur = n => (n==null||n==="")?"":Number(n).toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
function lsSet(k,v){ try{ localStorage.setItem("nakupy:"+k,JSON.stringify(v)); }catch(e){} }
function flash(t){ $("status").textContent=t; }

/* ---------- katalóg akcií ---------- */
function catalog(){            // všetky platné a budúce akcie, s id "obchod:index"
  const t=todayISO(), out=[];
  for(const [k,c] of Object.entries(state.katalog)){
    (c.items||[]).forEach((it,i)=>{ if(it.t && it.t<t) return; out.push({...it, store:k, id:k+":"+i}); });
  }
  return out;
}
const catVersion = () => Object.entries(state.katalog).map(([k,c])=>k+(c.updated||"")).sort().join("|");
const hasCatalog = () => catalog().length>0;
const status = d => (d.f && d.f>todayISO()) ? "next" : "now";

function tokenMatch(item, d){
  const words = norm(item).split(" ").filter(w=>w.length>=3);
  if(!words.length) return false;
  const dw = norm(d.n+" "+(d.k||"")).split(" ");
  return words.every(w=>{ const stem=w.length<=5?w:w.slice(0,-1); return dw.some(x=>x.startsWith(stem)); });
}
/* Bezplatné hľadanie: slová položky + slovník príbuzných výrazov (bez AI). */
const SYN = {
  "maso":["bravcove maso","hovadzie maso","kuracie maso","mlete maso","krkovicka","bravcove plece","bravcovy bocik","bravcove kare","kuracie stehna","kuracie prsia","kuracie rezne","kuracie prsne","hovadzie stehno","morcacie maso","teľacie maso"],
  "bravcove":["krkovicka","bravcove plece","bravcove kare","bravcovy bocik","bravcove maso"],
  "kuracie":["kuracie","kura","kuraci"],
  "kuracie prsia":["kuracie prsia","kuracie prsne","kuracie rezne","prsne filety"],
  "pivo":["pivo","lezak","radler","bazant","krusovice","pilsner","kozel","radegast","smadny","staropramen","budweiser","corgon","saris","topvar","argus","birell","heineken","gambrinus","velkopopovicky"],
  "mlieko":["mlieko","trvanlive mlieko","cerstve mlieko"],
  "jogurt":["jogurt","jogobella","activia","actimel","kefir","skyr","zott","rajo"],
  "syr":["syr","eidam","gouda","mozzarella","niva","bryndza","parenica","encian","hermelin","camembert","cedar","tavene"],
  "sunka":["sunka","sunkova","sunkovy"],
  "salama":["salama","saláma","klobasa","sajdik"],
  "parky":["parky","parky","frankfurtske","viedenske","spekacky"],
  "kava":["kava","espresso","cappuccino","nescafe","jacobs","tchibo","lavazza","segafredo","eduscho","douwe"],
  "caj":["caj","cajove"],
  "chlieb":["chlieb","bageta","rozok","rozky","bulka","toast"],
  "rozky":["rozok","rozky","bageta"],
  "ovocie":["jablka","jablko","banany","pomaranc","mandarinky","hrozno","hrusky","citrony","kiwi","ananas","clementinky"],
  "zelenina":["zemiaky","paprika","uhorka","paradajky","rajciaky","mrkva","cibula","kapusta","brokolica","salat"],
  "paradajky":["paradajky","rajciaky","cherry"],
  "zemiaky":["zemiaky","zemiaky konzumne"],
  "vajcia":["vajcia","vajicka","vajce"],
  "maslo":["maslo","maslove"],
  "olej":["olej","slnecnicovy","olivovy","repkovy"],
  "cokolada":["cokolada","cokoladky","milka","orion","figaro","lindt","kinder","toblerone"],
  "voda":["voda","mineralna","budis","rajec","bonaqua","dobra voda","mattoni","salvator","fatra"],
  "vino":["vino","biele vino","cervene vino","ruzove","sekt","prosecco"],
    "pracipraskok":["praci prasok","praci gel","persil","ariel","gel na pranie"],
  "toaletny papier":["toaletny papier","toaletny","zewa","tento","velvet"],
  "plienky":["plienky","pampers","huggies","lupilu"],
};
function variants(item){
  const n=norm(item), out=[item];
  for(const [k,v] of Object.entries(SYN)){ if(n===k || (k.includes(" ")&&n.includes(k))) out.push(...v); }
  return out;
}
function dealsFor(name){
  const cat=catalog(), vs=variants(name);
  const list=cat.filter(d=>vs.some(v=>tokenMatch(v,d)));
  return list.sort((a,b)=>(status(a)==="now"?0:1)-(status(b)==="now"?0:1)||(a.p??99)-(b.p??99));
}
function queueSemantic(){}

/* ---------- ukladanie (Firestore, spoločné pre domácnosť) ---------- */
// zoznam a kupóny sú spoločné; obľúbené má každý vlastné (pole "by"), ale ich zľavy vidia všetci členovia
const colRef = col => FB.collection(FB.db,"households",state.hh.id,col);
async function add(col, data){
  if(state.user){ data.by=state.user.email.toLowerCase(); data.byName=state.user.displayName||state.user.email; }
  try{ await FB.addDoc(colRef(col),data); }catch(e){ console.error(e); flash("Nepodarilo sa uložiť."); }
}
async function upd(col, id, data){
  try{ await FB.updateDoc(FB.doc(colRef(col),id),data); }catch(e){ console.error(e); flash("Nepodarilo sa uložiť."); }
}
async function del(col, id){
  try{ await FB.deleteDoc(FB.doc(colRef(col),id)); }catch(e){ console.error(e); flash("Nepodarilo sa zmazať."); }
}
const same = (a,b) => norm(a)===norm(b);
function addItem(name){
  name=name.trim(); if(!name) return;
  if(state.zoznam.some(i=>!i.done && same(i.name,name))) return flash("„"+name+"“ už v zozname je.");
  add("zoznam",{name, done:false, created:Date.now()});
}
const isFav = name => state.oblubene.find(f=>same(f.name,name));
function toggleFav(name){ const f=isFav(name); if(f) del("oblubene",f.id); else add("oblubene",{name, created:Date.now()}); }

/* ---------- render ---------- */
const STAR='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>';
const STAR_O='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/></svg>';
const X='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const TICK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PEN='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const PLUS='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>';

const dkey = d => d.store+"|"+d.n+"|"+(d.s||"");
function dealCard(d, act){
  const nx=status(d)==="next", pct=d.op&&d.p?Math.round((1-d.p/d.op)*100):null;
  const meta=[d.s, d.u, d.c?`<span class="cond">${esc(d.c)}</span>`:"", nx?`<span class="when">platí od ${fmtD(d.f)}</span>`:(d.t?"do "+fmtD(d.t):"")].filter(Boolean);
  const tag=act?"button":"div", attrs=act?` data-act="pick" ${act}`:"";
  return `<${tag} class="deal ${nx?"next":""} ${act&&act.includes("data-on=\"1\"")?"picked":""}"${attrs}>${STORES[d.store].logo}
    <span class="info"><span class="pn">${esc(d.n)}${d.k?`<small> · ${esc(d.k)}</small>`:""}</span>
    <span class="pm">${meta.map(m=>m.startsWith("<")?m:esc(m)).join(" · ")}</span></span>
    <span class="pp"><b>${d.p!=null?eur(d.p):"akcia"}</b>${d.op||pct?`<span>${d.op?eur(d.op):""}${d.op&&pct?" · ":""}${pct?`<em>−${pct} %</em>`:""}</span>`:""}</span></${tag}>`;
}
const picksOf = i => Array.isArray(i.picks)? i.picks : (i.pick? [i.pick] : []);
function dealsBlock(i, col){
  const name=i.name, rowKey=col+i.id;
  if(!hasCatalog()) return `<div class="searching">Letáky ešte nie sú prehľadané.</div>`;
  let ds=dealsFor(name);
  const searching=state.pending.has(norm(name));
  const ref=`data-col="${col}" data-id="${i.id}"`;
  if(i.hide) return `<div class="dealtools"><button class="more" data-act="unhide" ${ref}>Zobraziť akcie (${ds.length})</button></div>`;
  const picks=picksOf(i), chosen=ds.filter(d=>picks.includes(dkey(d))), editing=state.open.has(rowKey);
  const card=d=>dealCard(d,`${ref} data-k="${esc(dkey(d))}" data-on="${picks.includes(dkey(d))?1:0}"`);
  if(chosen.length && !editing) return `<div class="deals">${chosen.map(card).join("")}</div>
    ${ds.length>chosen.length?`<div class="dealtools"><button class="more" data-act="more" data-k="${esc(rowKey)}">Vybrať ďalšiu ponuku (${ds.length-chosen.length})</button></div>`:""}`;
  if(state.shop!=="all") ds=ds.filter(d=>d.store===state.shop||picks.includes(dkey(d)));
  if(!ds.length) return searching? `<div class="searching"><i></i>Hľadám v letákoch…</div>` : `<div class="searching">${state.shop!=="all"?"V "+STORES[state.shop].name+" nie je v akcii.":"V aktuálnych letákoch nie je v akcii."}</div>`;
  return `<div class="deals">${ds.map(card).join("")}</div>
    <div class="dealtools">${editing?`<button class="more" data-act="more" data-k="${esc(rowKey)}">Hotovo</button>`:(ds.length>1?`<span class="searching" style="grid-column:auto">Ťukni na ponuku, ktorú chceš kúpiť</span>`:"")}
    ${editing?"":`<button class="more" data-act="hide" ${ref} style="color:var(--muted)">Skryť akcie</button>`}</div>`
    + (searching?`<div class="searching"><i></i>Hľadám ďalšie…</div>`:"");
}
function whoLine(i){
  const authors=new Set([...state.zoznam,...state.oblubene].map(x=>x.by).filter(Boolean));
  if(authors.size<2 || !i.byName) return "";
  return `<div class="who">pridal/a ${esc(String(i.byName).split(" ")[0])}</div>`;
}
function itemRow(i){
  const fav=isFav(i.name);
  return `<li class="item ${i.done?"done":""}">
    <button class="check" data-act="toggle" data-id="${i.id}" aria-label="${i.done?"Vrátiť":"Kúpené"}: ${esc(i.name)}">${i.done?TICK:""}</button>
    <span class="name">${esc(i.name)}</span>
    <button class="icon ${fav?"on":""}" data-act="fav" data-name="${esc(i.name)}" aria-label="${fav?"Odobrať z obľúbených":"Pridať do obľúbených"}">${fav?STAR:STAR_O}</button>
    <button class="icon" data-act="del" data-id="${i.id}" aria-label="Zmazať ${esc(i.name)}">${X}</button>
    ${whoLine(i)}${i.done?"":dealsBlock(i,"zoznam")}
  </li>`;
}
function shopSelect(){
  return `<select class="shop" id="shopSel" aria-label="Som v obchode"><option value="all">Všetky obchody</option>${Object.entries(STORES).map(([k,v])=>`<option value="${k}" ${state.shop===k?"selected":""}>Som v ${v.name}</option>`).join("")}</select>`;
}
function renderZoznam(){
  let open=state.zoznam.filter(i=>!i.done).sort((a,b)=>(a.created||0)-(b.created||0));
  const done=state.zoznam.filter(i=>i.done);
  if(state.shop!=="all"){ const has=i=>dealsFor(i.name).some(d=>d.store===state.shop); open=[...open.filter(has),...open.filter(i=>!has(i))]; }
  let h=`<form class="add" id="addForm"><input id="addInput" placeholder="Pridať do zoznamu…" autocomplete="off" aria-label="Nová položka"><button class="btn">Pridať</button></form>`;
  if(!open.length && !done.length) h+=`<div class="empty"><b>Zoznam je prázdny</b>Napíš, čo treba kúpiť. Pri každej veci uvidíš, kde je v akcii, za koľko a za akých podmienok.</div>`;
  else {
    const onSale=open.filter(i=>dealsFor(i.name).some(d=>state.shop==="all"||d.store===state.shop)).length;
    h+=`<div class="sec"><div class="left"><h2>Kúpiť (${open.length})</h2>${shopSelect()}</div><span class="date">${onSale? onSale+" v akcii":""}</span></div>`;
    h+= open.length? `<ul class="list">${open.map(itemRow).join("")}</ul>` : `<div class="empty"><b>Všetko kúpené</b>Pekná práca.</div>`;
    if(done.length) h+=`<div class="sec"><h2>Kúpené (${done.length})</h2><button class="link" data-act="clear">Vymazať kúpené</button></div><ul class="list">${done.map(itemRow).join("")}</ul>`;
  }
  if((state.hh?.emails||[]).length<2) h+=`<p class="share">Nakupujete spolu? Pridaj člena domácnosti cez tlačidlo vpravo hore.</p>`;
  $("v-zoznam").innerHTML=h;
}
function renderOblubene(){
  const favs=[...state.oblubene].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
  let h=`<form class="add" id="favForm"><input id="favInput" placeholder="Pridať obľúbenú vec…" autocomplete="off" aria-label="Nová obľúbená"><button class="btn">Pridať</button></form>`;
  if(!favs.length) h+=`<div class="empty"><b>Žiadne obľúbené</b>Pridaj veci, ktoré kupuješ často. Keď budú v zľave, upozorním ťa. Hviezdičkou ich pridáš aj priamo zo zoznamu.</div>`;
  else h+=`<ul class="list">${favs.map(f=>{ const inList=state.zoznam.some(i=>!i.done&&same(i.name,f.name));
    return `<li class="item"><span class="icon on" aria-hidden="true">${STAR}</span><span class="name">${esc(f.name)}</span>
      <button class="icon" data-act="tolist" data-name="${esc(f.name)}" aria-label="Pridať do zoznamu" ${inList?"disabled title='Už je v zozname' style='opacity:.35'":""}>${PLUS}</button>
      <button class="icon" data-act="delfav" data-id="${f.id}" aria-label="Odobrať ${esc(f.name)}">${X}</button>
      ${dealsBlock(f,"oblubene")}</li>`; }).join("")}</ul>`;
  $("v-oblubene").innerHTML=h;
}
const daysLeft = iso => { if(!iso) return null; const a=new Date(iso+"T00:00:00"), b=new Date(todayISO()+"T00:00:00"); return Math.round((a-b)/864e5); };
const leftTxt = n => n===0?"končí dnes":n===1?"končí zajtra":n<0?"vypršal":`ešte ${n} ${n<5?"dni":"dní"}`;
function renderAlert(){
  const me=(state.user?.email||"").toLowerCase(), seenFav=new Map();
  for(const f of (state.oblubeneAll||state.oblubene)){ if(f.hide) continue; const k=norm(f.name); const cur=seenFav.get(k);
    if(!cur) seenFav.set(k,{...f, who:new Set([f.by===me?"ty":String(f.byName||f.by||"").split(" ")[0]])}); else cur.who.add(f.by===me?"ty":String(f.byName||f.by||"").split(" ")[0]); }
  const multi=(state.hh?.emails||[]).length>1;
  const hits=[...seenFav.values()].map(f=>({f,ds:dealsFor(f.name)})).filter(h=>h.ds.length), el=$("alert");
  const soon=state.kupony.filter(c=>{ const n=daysLeft(c.until); return n!=null && n>=0 && n<=2; });
  if(!hits.length && !soon.length){ el.hidden=true; return; }
  el.hidden=false; el.className="alert";
  let h=`<span class="bell" aria-hidden="true">!</span><div style="display:grid;gap:10px;min-width:0">`;
  if(soon.length) h+=`<div><b>${soon.length===1?"Kupón čoskoro končí":"Kupóny čoskoro končia: "+soon.length}</b><ul>${soon.map(c=>`<li><b style="display:inline;font-family:inherit;font-size:inherit">${esc(c.store)}</b> ${leftTxt(daysLeft(c.until))}: <code style="font-weight:700">${esc(c.code)}</code>${c.desc?" · "+esc(c.desc):""} <button class="more" data-act="copy" data-code="${esc(c.code)}">Kopírovať</button></li>`).join("")}</ul></div>`;
  if(hits.length) h+=`<div><b>${hits.length===1?"Obľúbená vec je v zľave":"Obľúbené veci v zľave: "+hits.length}</b><ul>${hits.slice(0,6).map(({f,ds})=>{const d=ds[0];return `<li><b style="display:inline;font-family:inherit;font-size:inherit">${esc(f.name)}</b>${multi?` <span style="color:var(--muted)">(${esc([...f.who].join(", "))})</span>`:""}: ${esc(STORES[d.store].name)} ${esc(eur(d.p))}${d.s?" / "+esc(d.s):""}${d.c?" ("+esc(d.c)+")":""}${status(d)==="next"?" od "+fmtD(d.f):""}${ds.length>1?` a ${ds.length-1}× inde`:""}${state.zoznam.some(i=>!i.done&&same(i.name,f.name))?` <span style="color:var(--muted)">· v zozname</span>`:` <button class="more" data-act="tolist" data-name="${esc(f.name)}">+ do zoznamu</button>`}</li>`}).join("")}</ul></div>`;
  el.innerHTML=h+`</div>`;
}
function renderKupony(){
  const list=[...state.kupony].sort((a,b)=>(a.until||"9999").localeCompare(b.until||"9999"));
  const ed=state.editCpn && state.kupony.find(c=>c.id===state.editCpn);
  let h=`<form class="cform" id="cForm">${ed?`<b class="full" style="font-family:var(--f-display)">Upraviť kupón</b>`:""}
    <label>Obchod<input id="cStore" list="cStores" required placeholder="napr. Billa" autocomplete="off" value="${ed?esc(ed.store):""}"></label>
    <datalist id="cStores">${Object.values(STORES).map(s=>`<option value="${esc(s.name)}">`).join("")}</datalist>
    <label>Platí do<input id="cUntil" type="date" value="${ed?esc(ed.until||""):""}"></label>
    <label class="full">Kód kupónu<input id="cCode" required placeholder="napr. ZIMA5" autocomplete="off" value="${ed?esc(ed.code):""}"></label>
    <label class="full">Popis a podmienky<input id="cDesc" placeholder="napr. 5 € zľava pri nákupe nad 50 €" autocomplete="off" value="${ed?esc(ed.desc||""):""}"></label>
    ${ed?`<button class="btn">Uložiť</button><button class="btn ghost" type="button" data-act="canceledit">Zrušiť</button>`:`<button class="btn full">Pridať kupón</button>`}</form>`;
  if(!list.length) h+=`<div class="empty"><b>Žiadne kupóny</b>Pridaj kupón s kódom a dátumom. Dva dni pred koncom platnosti ťa upozorním hore v zozname.</div>`;
  else h+=`<div class="list">${list.map(c=>{ const n=daysLeft(c.until);
    return `<div class="cpn ${n!=null&&n<0?"old":""}"><div class="top"><b>${esc(c.store)}</b><span style="display:flex;gap:2px"><button class="icon" data-act="editcpn" data-id="${c.id}" aria-label="Upraviť kupón">${PEN}</button><button class="icon" data-act="delcpn" data-id="${c.id}" aria-label="Zmazať kupón">${X}</button></span></div>
      <div class="code"><code>${esc(c.code)}</code><button class="copy" data-act="copy" data-code="${esc(c.code)}">Kopírovať</button></div>
      ${c.desc?`<div class="desc">${esc(c.desc)}</div>`:""}
      ${c.until?`<div class="exp ${n!=null&&n<=2?"soon":""}">Platí do ${fmtD(c.until)}${c.until.slice(0,4)!==todayISO().slice(0,4)?c.until.slice(0,4):""} · ${leftTxt(n)}</div>`:`<div class="exp">Bez dátumu platnosti</div>`}</div>`; }).join("")}</div>`;
  $("v-kupony").innerHTML=h;
}
function leafletInfo(k){
  const base=LEAFLETS[k], o=state.katalog[k]||{}, t=todayISO();
  let cur={...base.current,...(o.current||{})}, next=("next" in o)?o.next:(base.next||null);
  if(next && next.from && next.from<=t){ cur=next; next=null; }
  return {cur, next, stale:cur.to&&cur.to<t, extra:base.extra||[], hint:base.hint, web:!!base.web};
}
function storeBtn(k){
  const s=STORES[k], L=leafletInfo(k), cnt=state.zoznam.filter(i=>!i.done && dealsFor(i.name).some(d=>d.store===k)).length;
  const sub = L.next? "+ nový "+fmtD(L.next.from) : (L.cur.to&&!L.stale? "do "+fmtD(L.cur.to) : "");
  return `<button class="store" data-store="${k}" aria-label="Leták ${s.name}">${s.logo}${cnt?`<span class="dot">${cnt}</span>`:""}<small>${sub}</small></button>`;
}
function renderDock(){
  $("dock").innerHTML=MAIN.map(storeBtn).join("");
  const rest=Object.keys(STORES).filter(k=>!MAIN.includes(k));
  $("dockMore").innerHTML=`<div class="dock-h">Letáky</div>`+rest.filter(k=>!LEAFLETS[k].web).map(storeBtn).join("")
    +`<div class="dock-h">Len web, bez letáku</div>`+rest.filter(k=>LEAFLETS[k].web).map(storeBtn).join("");
}
function setDock(open){ $("dockNav").classList.toggle("open",open); $("grip").setAttribute("aria-expanded",open); }
function openSheet(k){
  const s=STORES[k], L=leafletInfo(k), range=x=>x.from?`${fmtD(x.from)} – ${fmtD(x.to)}`:"";
  const mine=state.zoznam.filter(i=>!i.done).flatMap(i=>dealsFor(i.name).filter(d=>d.store===k));
  const uniq=[...new Map(mine.map(d=>[d.id,d])).values()];
  $("sheetIn").innerHTML=`<div style="display:flex;align-items:center;gap:12px">${s.logo}<h3>${L.web?"Web":"Letáky"} ${s.name}</h3></div>
    <a class="lf" href="${esc(L.cur.url)}" target="_blank" rel="noopener"><b>${L.web?"Akcie na webe":"Aktuálny leták"}${L.web?"":`<span class="pill">platí</span>`}</b><span class="go">${L.web?"Otvoriť web ↗":"Otvoriť leták ↗"}</span><span class="when">${L.web?"Obchod nemá leták":(L.stale||!L.cur.from?"Stránka letákov, vždy najnovší":range(L.cur))}</span></a>
    ${L.next?`<a class="lf upcoming" href="${esc(L.next.url)}" target="_blank" rel="noopener"><b>Budúci leták<span class="pill">od ${fmtD(L.next.from)}</span></b><span class="go">Otvoriť ↗</span><span class="when">${range(L.next)}</span></a>`:(L.web? (L.hint&&L.hint!=="Obchod nemá leták"?`<p class="note" style="margin:0">${esc(L.hint)}</p>`:"") : `<p class="note" style="margin:0">${esc(L.hint||"Budúci leták zatiaľ nie je zverejnený.")}</p>`)}
    ${L.extra.length?`<div class="extra">${L.extra.map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.label)} ↗</a>`).join("")}</div>`:""}
    ${uniq.length?`<div style="display:grid;gap:6px"><div class="sec" style="margin:4px 0 0"><h2>Zo zoznamu v akcii (${uniq.length})</h2></div>${uniq.map(d=>dealCard(d)).join("")}</div>`:""}
    ${state.katalog[k]?.updated?`<p class="note" style="margin:0">Leták prehľadaný ${fmtD(state.katalog[k].updated)}</p>`:`<p class="note" style="margin:0">Akcie z tohto obchodu zatiaľ nie sú v aplikácii prehľadané.</p>`}
    <button class="btn ghost" data-act="close">Zavrieť</button>`;
  $("scrim").hidden=false; $("sheet").hidden=false;
}
function closeSheet(){ $("scrim").hidden=true; $("sheet").hidden=true; }

function render(){
  for(const t of ["zoznam","kupony","oblubene"]){ $("t-"+t).setAttribute("aria-selected",state.tab===t); $("v-"+t).hidden=state.tab!==t; }
  const favHits=state.oblubene.filter(f=>dealsFor(f.name).length).length;
  $("t-oblubene").innerHTML="Obľúbené"+(favHits?` <span class="badge">${favHits}</span>`:"");
  const ae=document.activeElement, keep=ae&&ae.tagName==="INPUT"&&ae.id, val=keep&&ae.value;
  const soonC=state.kupony.filter(c=>{const n=daysLeft(c.until);return n!=null&&n>=0&&n<=2;}).length;
  $("t-kupony").innerHTML="Kupóny"+(soonC?` <span class="badge">${soonC}</span>`:"");
  renderAlert(); renderZoznam(); renderKupony(); renderOblubene(); renderDock();
  if(keep && $(keep)){ const e=$(keep); e.value=val; e.focus(); }
}

/* ---------- udalosti ---------- */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act],[data-store],.tab"); if(!b) return;
  if(b.classList.contains("tab")){ state.tab=b.id.slice(2); render(); return; }
  if(b.dataset.store){ openSheet(b.dataset.store); return; }
  const a=b.dataset.act, id=b.dataset.id, name=b.dataset.name;
  if(a==="toggle"){ const i=state.zoznam.find(x=>x.id===id); upd("zoznam",id,{done:!i.done}); }
  else if(a==="del") del("zoznam",id);
  else if(a==="fav") toggleFav(name);
  else if(a==="quick"||a==="tolist") addItem(name);
  else if(a==="delfav") del("oblubene",id);
  else if(a==="clear") state.zoznam.filter(i=>i.done).forEach(i=>del("zoznam",i.id));
  else if(a==="pick"){ const col=b.dataset.col, it=state[col].find(x=>x.id===id); if(!it) return;
    const k=b.dataset.k, cur=picksOf(it), next=cur.includes(k)? cur.filter(x=>x!==k) : [...cur,k];
    if(!cur.includes(k)) state.open.delete(col+id);
    upd(col,id,{picks:next, pick:null}); }
  else if(a==="hide") upd(b.dataset.col,id,{hide:true});
  else if(a==="unhide") upd(b.dataset.col,id,{hide:false});
  else if(a==="more"){ const k=b.dataset.k; state.open.has(k)?state.open.delete(k):state.open.add(k); render(); }
  else if(a==="close") closeSheet();
  else if(a==="delcpn"){ if(state.editCpn===id) state.editCpn=null; del("kupony",id); }
  else if(a==="editcpn"){ state.editCpn=id; render(); $("cStore")?.focus(); window.scrollTo({top:0,behavior:"smooth"}); }
  else if(a==="canceledit"){ state.editCpn=null; render(); }
  else if(a==="copy"){ const code=b.dataset.code;
    const ok=()=>{ const t=b.textContent; b.textContent="Skopírované"; setTimeout(()=>b.textContent=t,1500); };
    try{ navigator.clipboard.writeText(code).then(ok,()=>selectCode(b)); }catch(_){ selectCode(b); } }
});
$("scrim").addEventListener("click",closeSheet);
function selectCode(b){ const c=b.parentElement.querySelector("code")||b.closest("li")?.querySelector("code"); if(!c) return; const r=document.createRange(); r.selectNodeContents(c); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
/* vyťahovacia lišta: ťuknutie alebo potiahnutie */
(()=>{ const g=$("grip"); let y0=null, moved=false;
  g.addEventListener("pointerdown",e=>{ y0=e.clientY; moved=false; try{g.setPointerCapture(e.pointerId);}catch(_){} });
  g.addEventListener("pointermove",e=>{ if(y0==null) return; const dy=e.clientY-y0; if(Math.abs(dy)>25){ moved=true; setDock(dy<0); y0=null; } });
  g.addEventListener("pointerup",()=>{ if(y0!=null && !moved) setDock(!$("dockNav").classList.contains("open")); y0=null; });
  g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setDock(!$("dockNav").classList.contains("open")); } });
})();
document.addEventListener("change",e=>{ if(e.target.id==="shopSel"){ state.shop=e.target.value; lsSet("shop",state.shop); render(); } });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeSheet(); });
document.addEventListener("submit",e=>{
  e.preventDefault();
  if(e.target.id==="addForm"){ const v=$("addInput").value; $("addInput").value=""; addItem(v); }
  if(e.target.id==="cForm"){ const d={store:$("cStore").value.trim(), code:$("cCode").value.trim(), until:$("cUntil").value||"", desc:$("cDesc").value.trim(), created:Date.now()};
    if(!d.store||!d.code) return;
    if(state.editCpn){ const id=state.editCpn; state.editCpn=null; delete d.created; upd("kupony",id,d); render(); }
    else { add("kupony",d); e.target.reset(); } }
  if(e.target.id==="favForm"){ const v=$("favInput").value.trim(); $("favInput").value=""; if(v&&!isFav(v)) add("oblubene",{name:v,created:Date.now()}); }
});

/* ---------- účet a členovia ---------- */
function renderAcct(){
  const u=state.user; if(!u) return;
  $("acct").innerHTML = u.photoURL? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc((u.displayName||u.email||"?")[0].toUpperCase())}</span>`;
}
function openMembers(){
  const hh=state.hh, me=state.user.email.toLowerCase(), owner=hh.owner===me;
  $("sheetIn").innerHTML=`<h3>${esc(hh.name||"Domácnosť")}</h3>
    <p class="note" style="margin:0">Prihlásený: <b>${esc(state.user.displayName||"")}</b> ${esc(state.user.email)}</p>
    ${state.households.length>1?`<label class="note" style="display:grid;gap:4px">Zoznam domácnosti<select class="shop" id="hhSel">${state.households.map(h=>`<option value="${h.id}" ${h.id===hh.id?"selected":""}>${esc(h.name||"Domácnosť")} (${h.emails.length})</option>`).join("")}</select></label>`:""}
    <div class="sec" style="margin:4px 0 0"><h2>Členovia (${hh.emails.length})</h2></div>
    <div class="members">${hh.emails.map(e=>`<div class="mrow"><span>${esc(e)} ${e===hh.owner?"<small>· založil</small>":""}${e===me?"<small> · ty</small>":""}</span>
      ${(owner&&e!==me)?`<button class="link" data-act="rmMember" data-email="${esc(e)}">Odobrať</button>`:""}</div>`).join("")}</div>
    <form class="add" id="memberForm" style="margin:0"><input id="memberInput" type="email" placeholder="e-mail (Google účet)" autocomplete="off" aria-label="E-mail nového člena"><button class="btn">Pridať</button></form>
    <p class="note" style="margin:0">Nový člen otvorí túto aplikáciu, prihlási sa cez Google týmto e-mailom a hneď uvidí váš spoločný zoznam a kupóny. Obľúbené má každý svoje, no keď je niečo z nich v zľave, upozornenie uvidia všetci.</p>
    ${(!owner)?`<button class="link" data-act="leave" style="color:var(--sale);justify-self:start">Opustiť túto domácnosť</button>`:""}
    <button class="btn ghost" data-act="logout">Odhlásiť sa</button>
    <button class="btn ghost" data-act="close">Zavrieť</button>`;
  $("scrim").hidden=false; $("sheet").hidden=false;
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]"); if(!b) return;
  const a=b.dataset.act;
  if(a==="members") openMembers();
  else if(a==="logout"){ closeSheet(); await FB.signOut(FB.auth); }
  else if(a==="rmMember"){ await FB.updateDoc(FB.doc(FB.db,"households",state.hh.id),{emails:FB.arrayRemove(b.dataset.email)}).catch(()=>flash("Člena sa nepodarilo odobrať.")); }
  else if(a==="leave"){ const me=state.user.email.toLowerCase(); await FB.updateDoc(FB.doc(FB.db,"households",state.hh.id),{emails:FB.arrayRemove(me)}).catch(()=>{}); closeSheet(); location.reload(); }
});
document.addEventListener("submit",async e=>{
  if(e.target.id!=="memberForm") return;
  e.preventDefault();
  const v=$("memberInput").value.trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return flash("Zadaj platný e-mail.");
  await FB.updateDoc(FB.doc(FB.db,"households",state.hh.id),{emails:FB.arrayUnion(v)}).then(()=>flash("Pridané: "+v)).catch(()=>flash("Člena sa nepodarilo pridať."));
});
document.addEventListener("change",e=>{ if(e.target.id==="hhSel"){ lsSet("hh",e.target.value); location.reload(); } });

/* ---------- štart ---------- */
async function loadCatalog(){
  try{ const r=await fetch("data/katalog.json",{cache:"no-cache"}); const j=await r.json(); state.katalog=j.stores||{}; render(); }
  catch(e){ console.error(e); }
}
let unsubs=[];
async function startHousehold(user){
  const email=user.email.toLowerCase();
  const q=FB.query(FB.collection(FB.db,"households"),FB.where("emails","array-contains",email));
  let snap=await FB.getDocs(q);
  if(snap.empty){
    await FB.addDoc(FB.collection(FB.db,"households"),{name:"Náš nákup", owner:email, emails:[email], created:Date.now()});
    snap=await FB.getDocs(q);
  }
  state.households=snap.docs.map(d=>({id:d.id,...d.data()}));
  const want=lsGet("hh"), first=state.households.find(h=>h.id===want)||state.households[0];
  unsubs.forEach(u=>u()); unsubs=[];
  unsubs.push(FB.onSnapshot(FB.doc(FB.db,"households",first.id),d=>{
    if(!d.exists()){ return; }
    state.hh={id:d.id,...d.data()};
    if(!state.hh.emails.includes(email)){ location.reload(); return; }
    render();
  }));
  state.hh={...first};
  for(const col of ["zoznam","oblubene","kupony"]){
    unsubs.push(FB.onSnapshot(colRef(col),s=>{ const rows=s.docs.map(d=>({id:d.id,...d.data()}));
      if(col==="oblubene"){ state.oblubeneAll=rows; state.oblubene=rows.filter(r=>r.by===email); } else state[col]=rows;
      flash(""); render(); },
      err=>{ console.error(err); flash("Dáta sa nedajú načítať. Skontroluj pripojenie."); }));
  }
}
// Automatické prihlásenie z hlavnej aplikácie (domter.lovable.app) cez jednorazový token v URL.
const urlAuthToken = new URLSearchParams(location.search).get("auth");
if(urlAuthToken){
  history.replaceState(null,"",location.pathname);
  FB.signInWithCustomToken(FB.auth,urlAuthToken).catch(e=>console.error("Automatické prihlásenie zlyhalo:",e));
}
FB.onAuthStateChanged(FB.auth, async user=>{
  if(user&&!user.email&&user.uid.includes("@"))user.email=user.uid;
  state.user=user;
  $("login").hidden=!!user; $("app").hidden=!user; $("dockNav").hidden=!user;
  if(!user){ unsubs.forEach(u=>u()); unsubs=[]; return; }
  renderAcct(); flash("Načítavam…");
  try{ await startHousehold(user); }catch(e){ console.error(e); flash("Prihlásenie prebehlo, ale zoznam sa nepodarilo otvoriť."); }
});
$("gbtn").addEventListener("click",async()=>{
  $("loginMsg").textContent="";
  try{ await FB.signInWithPopup(FB.auth,FB.provider); }
  catch(e){
    const inFrame = window.top!==window.self;
    if(["auth/popup-blocked","auth/operation-not-supported-in-this-environment","auth/cancelled-popup-request"].includes(e.code)){
      if(inFrame){ $("loginMsg").innerHTML=`Prihlásenie vo vloženom okne sa nepodarilo. <a href="${location.href}" target="_blank" rel="noopener">Otvor aplikáciu na celú obrazovku</a> a prihlás sa tam.`; return; }
      return FB.signInWithRedirect(FB.auth,FB.provider);
    }
    if(e.code!=="auth/popup-closed-by-user") $("loginMsg").textContent="Prihlásenie sa nepodarilo ("+e.code+").";
  }
});
FB.getRedirectResult(FB.auth).catch(e=>{ $("loginMsg").textContent="Prihlásenie sa nepodarilo ("+e.code+")."; });
loadCatalog();
render();
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
