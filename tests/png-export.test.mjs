import test from 'node:test';
import assert from 'node:assert/strict';
import {composePngFrame,encodePng,savePng} from '../png-export.js';

function canvasDocument(t,{context=true}={}) {
  const calls=[],drawing={fillStyle:'',fillRect(...args){calls.push(['fill',this.fillStyle,...args]);},drawImage(...args){calls.push(['draw',...args]);}};
  const canvas={width:0,height:0,getContext(kind){assert.equal(kind,'2d');return context?drawing:null;}};
  const original=globalThis.document;
  globalThis.document={createElement(kind){assert.equal(kind,'canvas');return canvas;}};
  t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
  return {canvas,calls};
}

test('colored PNGs fill the exact frame before copying the rendered pixels',t=>{
  const {canvas,calls}=canvasDocument(t),source={width:1920,height:1080};
  assert.equal(composePngFrame(source,{background:'#142a3b'}),canvas);
  assert.equal(canvas.width,1920);assert.equal(canvas.height,1080);
  assert.deepEqual(calls,[['fill','#142a3b',0,0,1920,1080],['draw',source,0,0]]);
  assert.deepEqual(source,{width:1920,height:1080});
});

test('transparent PNG composition leaves the backdrop unfilled',t=>{
  const {calls}=canvasDocument(t),source={width:800,height:450};
  composePngFrame(source,{transparent:true,background:'#ffffff'});
  assert.deepEqual(calls,[['draw',source,0,0]]);
});

test('unavailable scenes or canvas contexts report actionable errors',t=>{
  canvasDocument(t,{context:false});
  for(const source of [null,{}, {width:0,height:900},{width:1600,height:0}])assert.throws(()=>composePngFrame(source),/not ready/);
  assert.throws(()=>composePngFrame({width:1600,height:900}),/unavailable/);
});

test('PNG encoding uses lossless image/png and returns the blob',async()=>{
  const blob=new Blob(['pixels'],{type:'image/png'});
  assert.equal(await encodePng({toBlob(callback,mime){assert.equal(mime,'image/png');callback(blob);}}),blob);
});

test('failed or blocked PNG encoding rejects without a blank download',async()=>{
  await assert.rejects(encodePng({toBlob(callback){callback(null);}}),/Could not encode/);
  await assert.rejects(encodePng({toBlob(){throw new Error('Canvas is not origin-clean');}}),/origin-clean/);
});

test('PNG downloads attach a filename and release their object URL',t=>{
  const calls=[],link={remove(){calls.push('remove');},click(){calls.push(['click',this.href,this.download]);}};
  const original=globalThis.document;
  globalThis.document={createElement(kind){assert.equal(kind,'a');return link;},body:{append(value){assert.equal(value,link);calls.push('append');}}};
  t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
  t.mock.method(URL,'createObjectURL',()=> 'blob:png');
  t.mock.method(URL,'revokeObjectURL',url=>calls.push(['revoke',url]));
  t.mock.method(globalThis,'setTimeout',(callback,delay)=>{calls.push(['delay',delay]);callback();});
  savePng(new Blob(['png']),'erp-demo-transparent.png');
  assert.deepEqual(calls,['append',['click','blob:png','erp-demo-transparent.png'],'remove',['delay',1000],['revoke','blob:png']]);
});
