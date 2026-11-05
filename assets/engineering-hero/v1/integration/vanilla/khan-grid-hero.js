import { getSite } from '../../src/config.js';

/** Build the fixed embed shell without invoking the HTML parser. */
function createHeroShell(doc) {
  const node = (tag, attributes = {}, ...children) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.append(...children);
    return element;
  };
  const fragment = doc.createDocumentFragment();
  fragment.append(
    node('link', {rel: 'stylesheet'}),
    node('section', {class: 'frame', part: 'frame', 'aria-label': 'Conceptual engineering film'},
      node('div', {class: 'placeholder'},
        node('p', {class: 'eyebrow'}, 'Research / Models / Evidence'),
        node('h2', {}, 'From First Principles', node('br'), 'to Grid-Scale Reality'),
        node('p', {}, 'Dr. Mohammad Rezwan Khan')),
      node('img', {class: 'poster', alt: '', hidden: ''}),
      node('div', {class: 'controls'},
        node('button', {type: 'button', class: 'toggle', 'aria-pressed': 'false'}, 'Play animation'),
        node('button', {type: 'button', class: 'replay', hidden: ''}, 'Replay'))),
    node('div', {class: 'copy'},
      node('p', {}, 'Physics → executable models → evidence → energy systems. Illustrative telemetry; not live data, certified acceptance, plant control, or investment advice.'),
      node('a')),
    node('p', {class: 'sr-only', 'aria-live': 'polite'}));
  return fragment;
}
/** Same-origin, lifecycle-owned embed. Video is the default; WebGL requires explicit opt-in.
 * Copy this module with its relative directory structure, or let the host bundler resolve it.
 */
class KhanGridHero extends HTMLElement {
  static observedAttributes=['site','mode','video-src','poster-src','scene-src','cta-href','cta-label','hide-cta'];
  constructor(){super();this.attachShadow({mode:'open'});this._mounted=false;}
  connectedCallback(){if(!this._mounted)this.mount();}
  disconnectedCallback(){this.teardown();}
  attributeChangedCallback(){if(this._mounted){this.teardown();this.mount();}}
  localURL(value,fallback){
    const url=new URL(value||fallback,document.baseURI);
    if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))throw new Error('Hero media and iframe must use a same-origin HTTP(S) URL.');
    return url.href;
  }
  mount(){
    this._mounted=true;this._disposed=false;this._visible=false;this._playing=false;this._resume=false;this._frameReady=false;this._hasStarted=false;this._posterFailed=false;this._playRequest=0;this._generation=(this._generation||0)+1;
    this._reduced=matchMedia('(prefers-reduced-motion: reduce)');this._saveData=!!navigator.connection?.saveData;
    this._mode=this.getAttribute('mode')==='interactive'?'interactive':'video';this._site=getSite(this.getAttribute('site')||'mrkhan');
    this.shadowRoot.replaceChildren(createHeroShell(this.ownerDocument));
    this.shadowRoot.querySelector('link').href=new URL('./embed.css',import.meta.url).href;
    this._frame=this.shadowRoot.querySelector('.frame');this._placeholder=this.shadowRoot.querySelector('.placeholder');
    this._poster=this.shadowRoot.querySelector('.poster');this._toggle=this.shadowRoot.querySelector('.toggle');this._replay=this.shadowRoot.querySelector('.replay');this._status=this.shadowRoot.querySelector('[aria-live]');
    const link=this.shadowRoot.querySelector('a');link.href=this._site.href;link.textContent=this.getAttribute('cta-label')||this._site.cta;
    if(this.getAttribute('cta-href')){try{const url=new URL(this.getAttribute('cta-href'),document.baseURI);if(['http:','https:'].includes(url.protocol))link.href=url.href;}catch{ /* Keep the configured safe fallback. */ }}
    link.hidden=this.hasAttribute('hide-cta');
    if(this.getAttribute('poster-src')){
      try{this._poster.src=this.localURL(this.getAttribute('poster-src'));this._poster.hidden=false;
        this._poster.addEventListener('error',()=>{this._posterFailed=true;this._poster.hidden=true;this._placeholder.hidden=false;},{once:true});}
      catch(e){this._status.textContent=e.message;}
    }
    this._toggle.textContent=this._mode==='interactive'?'Explore interactive 3D':'Play animation';
    this._toggle.addEventListener('click',()=>{this._resume=false;this._playing?this.pause():this.play(true);});
    this._replay.addEventListener('click',()=>{if(this._video)this._video.currentTime=0;if(this._iframe)this.send('seek',{t:0});this.play(true);});
    this._intersection=new IntersectionObserver(([entry])=>{
      this._visible=entry.isIntersecting;
      if(!this._visible){this._resume=this._playing;this.pause();}
      else if(this._resume&&!this._reduced.matches&&!this._saveData){this._resume=false;this.play(false);}
      else if(this.hasAttribute('autoplay')&&!this._hasStarted&&this._mode==='video'&&!this._reduced.matches&&!this._saveData){this.play(false);}
    },{rootMargin:'0px',threshold:.12});this._intersection.observe(this);
    this._visibility=()=>{if(document.hidden){this._resume=this._playing;this.pause();}else if(this._resume&&this._visible&&!this._reduced.matches&&!this._saveData){this._resume=false;this.play(false);}};
    this._motion=()=>{if(this._reduced.matches){this._resume=false;this.pause();}};
    this._message=event=>{if(event.origin===location.origin&&event.source===this._iframe?.contentWindow&&event.data?.type==='khan-hero-ready'){
      clearTimeout(this._readyTimeout);this._frameReady=true;
      if(this._playing){this._iframe.hidden=false;this._placeholder.hidden=true;this._poster.hidden=true;this.send('play');}}};
    document.addEventListener('visibilitychange',this._visibility);this._reduced.addEventListener('change',this._motion);window.addEventListener('message',this._message);
  }
  send(action,extra={}){this._iframe?.contentWindow?.postMessage({type:'khan-hero-control',action,...extra},location.origin);}
  async play(explicit=false){
    if(this._disposed||document.hidden||(!explicit&&(!this._visible||this._reduced.matches||this._saveData)))return;
    const generation=this._generation,request=++this._playRequest;
    try{
      if(this._mode==='video'){
        if(!this._video){
          const src=this.localURL(this.getAttribute('video-src'),'./hero-1080p60.mp4');
          const video=document.createElement('video');this._video=video;
          video.muted=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-hidden','true');
          if(this._poster.src)video.poster=this._poster.src;
          video.loop=this.hasAttribute('loop');video.src=src;
          video.addEventListener('ended',()=>{this._playing=false;this.update();});
          video.addEventListener('error',()=>{this.pause();video.hidden=true;this._placeholder.hidden=false;this._poster.hidden=this._posterFailed||!this._poster.src;this._status.textContent='The film could not be loaded. The text summary remains available.';});
          this._frame.insertBefore(video,this.shadowRoot.querySelector('.controls'));
        }
        const currentVideo=this._video;
        await currentVideo.play();
        if(this._disposed||generation!==this._generation||request!==this._playRequest){currentVideo.pause();return;}
        currentVideo.hidden=false;
      }else{
        if(!this._iframe){
          const url=new URL(this.localURL(this.getAttribute('scene-src'),'./index.html'));
          url.searchParams.set('site',this.getAttribute('site')||'mrkhan');url.searchParams.set('embed','1');url.searchParams.set('autoplay','0');
          const iframe=document.createElement('iframe');this._iframe=iframe;iframe.title='Interactive engineering workbenches';
          iframe.loading='eager';iframe.referrerPolicy='same-origin';iframe.hidden=true;iframe.src=url.href;
          this._frame.insertBefore(iframe,this.shadowRoot.querySelector('.controls'));
          this._readyTimeout=setTimeout(()=>{if(this._disposed||generation!==this._generation||this._frameReady)return;this.pause();this._status.textContent='Interactive rendering is unavailable. The poster and text summary remain available.';},15000);
        }
        if(this._frameReady){this._iframe.hidden=false;this.send('play');}
      }
      this._playing=true;this._hasStarted=true;
      if(this._mode==='video'||this._frameReady){this._placeholder.hidden=true;this._poster.hidden=true;}
      this._replay.hidden=false;this.update();
    }catch(error){if(this._disposed||generation!==this._generation||request!==this._playRequest)return;this._playing=false;this._status.textContent='Playback unavailable. '+error.message;this.update();}
  }
  pause(){this._playRequest++;if(this._video)this._video.pause();this.send('pause');this._playing=false;this.update();}
  update(){if(!this._toggle)return;this._toggle.textContent=this._playing?'Pause animation':'Play animation';this._toggle.setAttribute('aria-pressed',String(this._playing));}
  teardown(){
    if(!this._mounted)return;this._disposed=true;this.pause();clearTimeout(this._readyTimeout);this._intersection?.disconnect();
    document.removeEventListener('visibilitychange',this._visibility);this._reduced?.removeEventListener('change',this._motion);window.removeEventListener('message',this._message);
    if(this._video){this._video.removeAttribute('src');this._video.load();this._video.remove();this._video=null;}
    if(this._iframe){this._iframe.src='about:blank';this._iframe.remove();this._iframe=null;}
    this._mounted=false;
  }
}
if(!customElements.get('khan-grid-hero'))customElements.define('khan-grid-hero',KhanGridHero);
export { KhanGridHero };
