import { COLORS as C, FILM, CHAPTERS, SITES, getSite } from '../config.js';
import { telemetry, timeline } from '../kinematics.js';
import { card, round, text, label, pill, line, check, grid, chart } from './draw.js';
export const PANEL_SIZE = Object.freeze({ width: 1024, height: 608 });
export function makeCanvas(width, height, dpr = FILM.textureDPR) {
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx) throw new Error('Canvas 2D is unavailable.');
  return { canvas, ctx, width, height, dpr, audit: [] };
}
export function clearSurface(s) {
  s.ctx.setTransform(1,0,0,1,0,0);s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);
  s.ctx.setTransform(s.dpr,0,0,s.dpr,0,0);s.ctx.globalAlpha=1;s.audit=[];
}
function base(s,index) {
  const {ctx:c,audit:a}=s, chapter=CHAPTERS[index];
  const g=c.createLinearGradient(0,0,1024,608);g.addColorStop(0,'rgba(5,12,25,0.93)');g.addColorStop(1,'rgba(9,19,36,0.87)');
  round(c,1,1,1022,606,25);c.fillStyle=g;c.fill();c.strokeStyle='rgba(255,255,255,0.38)';c.lineWidth=1;c.stroke();
  label(c,a,chapter.panelCode,32,40,C.orange,{maxWidth:260});
  pill(c,a,'ILLUSTRATIVE',817,19,174,C.muted);
  text(c,a,chapter.panelTitle,32,90,32,C.white,{weight:600,maxWidth:930});
  line(c,[[32,111],[992,111]],'#314054',1);
  label(c,a,'ASSUMPTIONS VISIBLE',32,581,C.muted,{maxWidth:430});
  label(c,a,'NO LIVE DATA',990,581,C.muted,{align:'right',maxWidth:210});
}
function physics(s,t) {
  const {ctx:c,audit:a}=s, d=telemetry(0,t);
  card(c,32,135,590,142);label(c,a,'LUMPED THERMAL BALANCE',52,166);
  text(c,a,'Cₜₕ · dT/dt = I²R − hA(T − Tₐ)',52,211,25,C.white,{mono:true,maxWidth:550});
  text(c,a,'Inputs → assumptions → response',52,250,19,C.muted,{maxWidth:550});
  card(c,644,135,348,142);label(c,a,'THERMAL RESPONSE',667,166);
  text(c,a,d.temperature.toFixed(1),667,225,49,C.orange,{weight:500,mono:true,maxWidth:205});
  text(c,a,'°C',842,223,27,C.muted,{maxWidth:105});
  label(c,a,'synthetic trace',667,256,C.muted,{maxWidth:300});
  card(c,32,298,590,245);label(c,a,'NORMALIZED RESPONSE',52,329);
  grid(c,69,353,523,148,3,6);
  chart(c,69,353,523,148,u=>.16+.67*(1-Math.exp(-4*u)),C.orange,Math.max(.06,d.p));
  chart(c,69,353,523,148,u=>.14+.64*(1-Math.exp(-4*u)),C.blue,Math.max(.06,d.p));
  label(c,a,'0',68,527,C.muted);label(c,a,'time / p.u.',591,527,C.muted,{align:'right'});
  card(c,644,298,348,245);label(c,a,'MODEL BOUNDARY',667,329);
  ['Lumped temperature','Fixed ambient','No safety prediction'].forEach((v,i)=>{
    check(c,679,369+i*44,true);text(c,a,v,704,375+i*44,19,C.white,{maxWidth:266});
  });
  label(c,a,'Research illustration',666,520,C.muted,{maxWidth:310});
}
function models(s,t) {
  const {ctx:c,audit:a}=s,d=telemetry(1,t);
  card(c,32,135,960,135);label(c,a,'POWER PATH / CONCEPTUAL',52,165);
  const names=['SOURCE','UPS / BESS','DC BUS','IT LOAD'];
  names.forEach((name,i)=>{
    const x=52+i*239;card(c,x,187,202,56,'#152338','#344763');
    text(c,a,name,x+101,221,18,i===1?C.orange:C.white,{mono:true,align:'center',maxWidth:187});
    if(i<3){line(c,[[x+204,215],[x+230,215]],C.blue,2);const p=(t*.7+i*.2)%1;c.beginPath();c.arc(x+207+20*p,215,3,0,Math.PI*2);c.fillStyle=C.blue;c.fill();}
  });
  card(c,32,291,566,252);label(c,a,'MODEL / LOCAL REFERENCE',52,323);
  const code=[['01','system = define(boundary);',C.white],['02','model  = build(system);',C.white],['03','trace  = simulate(model, t);',C.blue],['04','review(trace, assumptions);',C.orange]];
  const reveal=Math.max(1,Math.ceil(d.p*4));
  code.slice(0,reveal).forEach(([n,txt,color],i)=>{label(c,a,n,52,371+i*40,C.muted);text(c,a,txt,97,371+i*40,18,color,{mono:true,maxWidth:477});});
  if(d.cursor){c.fillStyle=C.orange;c.fillRect(97,518,11,3);}
  card(c,620,291,372,252);label(c,a,'INSPECTABLE BY DESIGN',643,323);
  [['01','Equations'],['02','Boundary conditions'],['03','Reproducible inputs'],['04','Known limitations']].forEach(([n,txt],i)=>{
    label(c,a,n,643,369+i*45,C.orange);text(c,a,txt,684,369+i*45,19,C.white,{maxWidth:283});
  });
}
function evidence(s,t) {
  const {ctx:c,audit:a}=s,d=telemetry(2,t);
  card(c,32,135,478,408);label(c,a,'REQUIREMENT → REVIEW',53,167);
  const rows=[['Requirement','Define acceptance criteria'],['Test plan','Identify the evidence'],['Traceability','Link result to requirement'],['Engineer review','Approval remains human']];
  rows.forEach(([name,sub],i)=>{
    const y=211+i*82;check(c,68,y+1,i<d.checks);
    text(c,a,name,97,y,23,i<d.checks?C.white:C.muted,{weight:500,maxWidth:383});
    text(c,a,sub,97,y+27,17,C.muted,{maxWidth:383});
    if(i<3)line(c,[[68,y+18],[68,y+59]],'#304256',1);
  });
  card(c,533,135,459,243);label(c,a,'RESPONSE / ILLUSTRATIVE',554,167);
  grid(c,556,196,412,139,3,6);
  chart(c,556,196,412,139,u=>.55+.24*Math.sin(u*21)*Math.exp(-u*3.4),C.blue,Math.max(.03,d.p));
  line(c,[[556,257],[968,257]],'#54677f',1);
  label(c,a,'response',556,362,C.blue);label(c,a,'reference',968,362,C.muted,{align:'right'});
  card(c,533,397,459,146);label(c,a,'ENGINEERING GATE',554,429);
  text(c,a,'Evidence, not assertion.',554,470,26,C.white,{weight:600,maxWidth:418});
  text(c,a,'Demo checks ≠ certified acceptance.',554,509,18,C.muted,{maxWidth:418});
}
function gridSystem(s,t) {
  const {ctx:c,audit:a}=s,d=telemetry(3,t);
  card(c,32,135,960,234);label(c,a,'NORMALIZED ENERGY FLOWS',53,167);
  grid(c,62,194,902,124,3,8);
  chart(c,62,194,902,124,u=>.43+.18*Math.sin(u*6.28+t*.21),C.orange,Math.max(.04,d.p));
  chart(c,62,194,902,124,u=>.30+.13*Math.sin(u*9+t*.14+1),C.blue,Math.max(.04,d.p));
  chart(c,62,194,902,124,u=>.56+.09*Math.sin(u*7+2),C.green,Math.max(.04,d.p));
  [['GENERATION',C.orange,53],['STORAGE',C.blue,345],['LOAD',C.green,606]].forEach(([str,col,x])=>label(c,a,str,x,349,col));
  const boxes=[['GENERATION','Wind + solar',C.orange],['STORAGE','BESS + control',C.blue],['DECISIONS','Limits + review',C.green]];
  boxes.forEach(([tag,txt,col],i)=>{
    const x=32+i*326;card(c,x,391,308,152);label(c,a,tag,x+20,424,col);
    text(c,a,txt,x+20,466,24,C.white,{weight:500,maxWidth:268});
    text(c,a,i===2?'Human accountability':'System-level relationships',x+20,508,16,C.muted,{maxWidth:268});
  });
}
export function drawPanel(s,index,t) {
  clearSurface(s);base(s,index);[physics,models,evidence,gridSystem][index](s,t);return s.audit;
}
export function drawHeader(s,index) {
  clearSurface(s);const {ctx:c,audit:a}=s,chapter=CHAPTERS[index];
  label(c,a,chapter.eyebrow,0,24,C.orange,{maxWidth:1580});
  text(c,a,chapter.title,0,92,64,C.white,{weight:600,maxWidth:1580});
  text(c,a,chapter.subtitle,3,140,26,C.muted,{maxWidth:1580});
  return a;
}
export function drawObjectLabel(s,index) {
  clearSurface(s);const {ctx:c,audit:a}=s;
  c.fillStyle=C.ink;c.fillRect(0,0,s.width,s.height);
  text(c,a,CHAPTERS[index].objectLabel,s.width/2,28,22,C.orange,{mono:true,align:'center',maxWidth:s.width});
  text(c,a,'CONCEPTUAL SYSTEM',s.width/2,53,15,C.muted,{mono:true,align:'center',maxWidth:s.width});
}
export function drawHUD(s,t,siteKey='mrkhan') {
  clearSurface(s);const {ctx:c,audit:a}=s,state=timeline(t),site=getSite(siteKey);
  // Screen-fixed typography is a transparent 2x canvas, not DOM/capture-clock animation.
  c.fillStyle=C.ink;c.fillRect(0,0,s.width,146);c.fillRect(0,918,s.width,s.height-918);
  card(c,68,51,62,62,'#0e1728','#4a3a34');text(c,a,'MK',99,92,22,C.orange,{weight:700,align:'center'});
  label(c,a,'FROM FIRST PRINCIPLES',154,74,C.white,{maxWidth:600});
  label(c,a,'TO GRID-SCALE REALITY',154,102,C.muted,{maxWidth:600});
  text(c,a,FILM.author,1852,80,22,C.white,{weight:500,align:'right',maxWidth:670});
  label(c,a,'RESEARCH  /  MODELS  /  EVIDENCE',1852,107,C.muted,{align:'right',maxWidth:690});
  line(c,[[68,142],[1852,142]],'#283145',1);
  text(c,a,String(state.stage+1).padStart(2,'0'),1835,254,67,'#76869d',{weight:300,mono:true,align:'right'});
  label(c,a,'/ 04',1833,286,C.muted,{align:'right'});
  const y=929, w=322, x0=68;
  CHAPTERS.forEach((ch,i)=>{
    const x=x0+i*w,active=i===state.stage;
    line(c,[[x,y],[x+w-36,y]],active?C.orange:'#303b50',active?3:1);
    label(c,a,`${String(i+1).padStart(2,'0')}  ${ch.nav.toUpperCase()}`,x,y+35,active?C.white:C.muted,{maxWidth:w-40});
  });
  label(c,a,'ILLUSTRATIVE · NOT LIVE DATA',1852,965,C.muted,{align:'right',maxWidth:520});
  if(state.endcard<.001){
    text(c,a,site.domain,68,1023,20,C.white,{mono:true,maxWidth:710});
    label(c,a,'ENGINEERING DECISIONS, WITH THEIR LIMITS IN VIEW.',1852,1023,C.muted,{align:'right',maxWidth:1030});
  } else {
    // Opaque labels appear as a clean cut rather than low-contrast fading semantic text.
    const domains=Object.values(SITES).map(v=>v.domain);
    domains.forEach((domain,i)=>text(c,a,domain,68+i*362,1023,18,i===0?C.orange:C.white,{mono:true,maxWidth:347}));
  }
  return a;
}
export function summarizeSurface(s) {
  return { width:s.width,height:s.height,dpr:s.dpr,items:s.audit,
    errors:s.audit.filter(b=>b.overflow || b.x<-.5 || b.y<-.5 || b.x+b.width>s.width+.5 || b.y+b.height>s.height+.5) };
}
