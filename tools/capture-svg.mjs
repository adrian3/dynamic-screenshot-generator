const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function region(rect,width,height){
  if(!rect||!['x','y','width','height'].every(key=>Number.isFinite(rect[key]))||rect.x<0||rect.y<0||rect.width<=0||rect.height<=0||rect.x+rect.width>width+.01||rect.y+rect.height>height+.01)throw new Error('A selected layer rectangle is outside the captured viewport.');
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"/>`;
}
function subtractRectangle(rect,cut){
  const left=Math.max(rect.x,cut.x),top=Math.max(rect.y,cut.y);
  const right=Math.min(rect.x+rect.width,cut.x+cut.width),bottom=Math.min(rect.y+rect.height,cut.y+cut.height);
  if(right<=left||bottom<=top)return [rect];
  return [
    {x:rect.x,y:rect.y,width:rect.width,height:top-rect.y},
    {x:rect.x,y:bottom,width:rect.width,height:rect.y+rect.height-bottom},
    {x:rect.x,y:top,width:left-rect.x,height:bottom-top},
    {x:right,y:top,width:rect.x+rect.width-right,height:bottom-top}
  ].filter(piece=>piece.width>0&&piece.height>0);
}
export function captureLayerSvg({id,title,image,width,height,regions,excludeRegions=[],backingColor=null}) {
  if(!/^[a-zA-Z][\w-]*$/.test(id)||!/^data:image\/png;base64,[\w+/=]+$/.test(image))throw new Error('Invalid capture image or layer ID.');
  if(backingColor!==null&&(typeof backingColor!=='string'||!/^#[0-9a-f]{6}$/i.test(backingColor)))throw new Error('A capture backing color must be a six-digit hex color.');
  for(const rect of [...regions,...excludeRegions])region(rect,width,height);
  // Remove higher planes from every lower plane, including overlapping or nested selections.
  const pieces=excludeRegions.reduce((remaining,cut)=>remaining.flatMap(rect=>subtractRectangle(rect,cut)),regions);
  const rectangles=pieces.map(rect=>region(rect,width,height)).join('');
  const backing=backingColor===null?'':`<g data-capture-backing="${id}" fill="${backingColor}" shape-rendering="crispEdges">${regions.map(rect=>region(rect,width,height)).join('')}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 ${width} ${height}"><title>${escape(title)}</title><desc>Authentic browser pixels, with higher-layer content removed${backingColor===null?'':` and cutouts backed with page color ${backingColor}`}.</desc><defs><mask id="${id}-regions" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" mask-type="alpha"><g fill="white" shape-rendering="crispEdges">${rectangles}</g></mask></defs>${backing}<image width="${width}" height="${height}" href="${image}" mask="url(#${id}-regions)"/></svg>\n`;
}
export function contentSegments(metadata) {
  if(!metadata.complete)throw new Error('The source capture is incomplete.');
  const {contentHeight,rect}=metadata.scroll,segments=[];let covered=0;
  for(const frame of metadata.frames){
    if(frame.scrollTop>covered+.01)throw new Error('The scrolling capture has a gap.');
    const end=Math.min(contentHeight,frame.scrollTop+rect.height);
    if(end<=covered)continue;
    segments.push({file:frame.file,top:covered,height:end-covered,imageX:0-rect.x,imageY:frame.scrollTop-rect.y});covered=end;
  }
  if(covered<contentHeight-.01)throw new Error('The scrolling capture is truncated.');
  return segments;
}
export function fullContentSvg(metadata,images) {
  const width=metadata.scroll.rect.width,height=metadata.scroll.contentHeight;
  const contents=contentSegments(metadata).map((segment,index)=>`<defs><clipPath id="tile-${index}"><rect x="0" y="${segment.top}" width="${width}" height="${segment.height}"/></clipPath></defs><image x="${segment.imageX}" y="${segment.imageY}" width="${metadata.viewport.width}" height="${metadata.viewport.height}" href="${images[segment.file]}" clip-path="url(#tile-${index})"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width*metadata.viewport.dpr)}" height="${Math.round(height*metadata.viewport.dpr)}" viewBox="0 0 ${width} ${height}"><title>Full scrollable content: ${escape(metadata.title)}</title><desc>Stitched inner scroll pane only; fixed navigation is stored separately.</desc>${contents}</svg>\n`;
}
export function fixedRegionSvg(metadata,image,fixed) {
  const r=fixed.rect;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(r.width*metadata.viewport.dpr)}" height="${Math.round(r.height*metadata.viewport.dpr)}" viewBox="0 0 ${r.width} ${r.height}"><title>${escape(fixed.name)}: ${escape(metadata.title)}</title><image x="${-r.x}" y="${-r.y}" width="${metadata.viewport.width}" height="${metadata.viewport.height}" href="${image}"/></svg>\n`;
}
