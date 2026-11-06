export function scrollPositions(height,viewportHeight,{overlap=64,maxTiles=12}={}) {
  if(!Number.isFinite(height)||!Number.isFinite(viewportHeight)||height<0||viewportHeight<=0)throw new Error('Invalid scrolling dimensions.');
  const end=Math.max(0,height-viewportHeight),step=Math.max(1,viewportHeight-overlap),positions=[0];
  for(let y=step;y<end;y+=step){positions.push(y);if(positions.length>=maxTiles)throw new Error('Page exceeds the capture tile limit.');}
  if(end)positions.push(end);
  if(positions.length>maxTiles)throw new Error('Page exceeds the capture tile limit.');
  return positions;
}

// Runs in the authorized browser tab. Only visible layout is collected, never storage or raw HTML.
export function collectCaptureMetadata() {
  const contexts=[],frames=[];
  function visit(doc,x=0,y=0,path=[]){
    contexts.push({doc,x,y,path});
    if(path.length>=4)return;
    for(const frame of doc.querySelectorAll('iframe')){
      const r=frame.getBoundingClientRect(),selector=frame.id?'#'+CSS.escape(frame.id):`iframe:nth-of-type(${[...frame.parentElement.children].filter(e=>e.tagName==='IFRAME').indexOf(frame)+1})`;
      let child=null;try{child=frame.contentDocument;}catch{}
      frames.push({id:frame.id,title:frame.title,accessible:!!child,rect:{x:x+r.x,y:y+r.y,width:r.width,height:r.height}});
      if(child&&r.width>0&&r.height>0)visit(child,x+r.x,y+r.y,[...path,selector]);
    }
  }
  visit(document);
  const box=(e,c)=>{const r=e.getBoundingClientRect();return {x:c.x+r.x,y:c.y+r.y,width:r.width,height:r.height};};
  const visible=(e,c)=>{const r=box(e,c),s=c.doc.defaultView.getComputedStyle(e);return r.width>0&&r.height>0&&r.y+r.height>0&&r.y<innerHeight&&s.display!=='none'&&s.visibility!=='hidden';};
  const candidates=[];
  for(const c of contexts)for(const e of c.doc.querySelectorAll('body *')){
    const r=box(e,c),s=c.doc.defaultView.getComputedStyle(e);
    if(r.width>innerWidth*.45&&r.height>innerHeight*.35&&e.scrollHeight>e.clientHeight+5&&/(auto|scroll)/.test(s.overflowY))candidates.push({e,c,area:r.width*r.height});
  }
  const chosen=candidates.sort((a,b)=>b.area-a.area)[0]||{e:document.scrollingElement,c:contexts[0]};
  const {e:scroller,c}=chosen,documentScroll=scroller===c.doc.scrollingElement;
  window.__livingCapture={scroller,top:scroller.scrollTop,left:scroller.scrollLeft};
  scroller.scrollTop=0;scroller.scrollLeft=0;
  const area=documentScroll?{x:c.x,y:c.y,width:c.doc.defaultView.innerWidth,height:c.doc.defaultView.innerHeight}:box(scroller,c);
  const nodes=contexts.flatMap(c=>[...c.doc.querySelectorAll('body *')].map(e=>({e,c})));
  return {
    version:1,url:location.href,title:document.title,capturedAt:new Date().toISOString(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
    scroll:{tag:scroller.tagName,selector:scroller.id?'#'+CSS.escape(scroller.id):scroller.tagName.toLowerCase(),framePath:c.path,documentScroll,rect:area,contentHeight:scroller.scrollHeight,originalTop:window.__livingCapture.top},
    fixedRegions:[{name:'header',rect:{x:0,y:0,width:innerWidth,height:Math.max(0,area.y)},outsideScroll:true},{name:'footer',rect:{x:0,y:area.y+area.height,width:innerWidth,height:Math.max(0,innerHeight-area.y-area.height)},outsideScroll:true}].filter(r=>r.rect.height>0),
    sticky:nodes.filter(({e,c})=>visible(e,c)&&['sticky','fixed'].includes(c.doc.defaultView.getComputedStyle(e).position)).map(({e,c})=>({tag:e.tagName,id:e.id,position:c.doc.defaultView.getComputedStyle(e).position,rect:box(e,c),label:(e.innerText||'').trim().slice(0,80)})).slice(0,80),
    panels:nodes.filter(({e,c})=>e.matches('section,article,[role="region"],[class*="portlet"],[class*="Portlet"],iframe')&&visible(e,c)&&box(e,c).width>180&&box(e,c).height>80).map(({e,c})=>({tag:e.tagName,id:e.id,classes:typeof e.className==='string'?e.className:'',title:e.title||e.getAttribute('aria-label')||(e.innerText||'').trim().slice(0,100),rect:box(e,c)})).slice(0,160),
    headings:nodes.filter(({e,c})=>e.matches('h1,h2,h3,[role="heading"]')&&visible(e,c)).map(({e,c})=>({text:e.innerText.trim().slice(0,100),rect:box(e,c)})),iframes:frames,
    notes:['Native authenticated Chrome pixels; no DOM reconstruction.','No cookies, credentials, session storage or raw HTML collected.','Header and footer are outside the selected scroll pane; internal CSS sticky elements are listed separately.','Same-origin embedded dashboards are inspected for scrolling; cross-origin frames are captured visually but their inner DOM is not accessed.']
  };
}
