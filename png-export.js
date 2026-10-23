export function composePngFrame(source,{transparent=false,background='#ffffff'}={}) {
  if(!source?.width||!source?.height)throw new Error('The scene is not ready to export.');
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('PNG export is unavailable in this browser.');
  if(!transparent){context.fillStyle=background;context.fillRect(0,0,canvas.width,canvas.height);}
  context.drawImage(source,0,0);
  return canvas;
}

export function encodePng(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode the PNG. Please try again.')),'image/png'));
}

export function savePng(blob,filename) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  try {
    link.href=url;link.download=filename;document.body.append(link);link.click();
  } finally {
    link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
