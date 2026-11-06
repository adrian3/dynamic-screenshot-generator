import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scrollPositions} from '../tools/capture-layout.mjs';
import {captureLayerSvg,contentSegments,fullContentSvg,fixedRegionSvg} from '../tools/capture-svg.mjs';

const metadata=()=>({complete:true,title:'Example & report',viewport:{width:1600,height:900,dpr:2},scroll:{rect:{x:0,y:80,width:1600,height:764},contentHeight:1699},frames:[{file:'top.png',scrollTop:0},{file:'middle.png',scrollTop:700},{file:'bottom.png',scrollTop:935}]});
const image='data:image/png;base64,AAAA';

test('capture tiles cover inner scrolling panes with overlap and an exact final position',()=>{
  assert.deepEqual(scrollPositions(1699,764),[0,700,935]);
  assert.deepEqual(scrollPositions(1944,837),[0,773,1107]);
  assert.deepEqual(scrollPositions(500,900),[0]);
  assert.deepEqual(scrollPositions(900,900),[0]);
  assert.throws(()=>scrollPositions(100000,500),/tile limit/);
  assert.throws(()=>scrollPositions(100,0),/dimensions/);
});

test('full-content segments remove repeated fixed chrome and overlapping strips',()=>{
  assert.deepEqual(contentSegments(metadata()),[
    {file:'top.png',top:0,height:764,imageX:0,imageY:-80},
    {file:'middle.png',top:764,height:700,imageX:0,imageY:620},
    {file:'bottom.png',top:1464,height:235,imageX:0,imageY:855}
  ]);
});

test('incomplete, gapped or truncated captures cannot become a scrolling source',()=>{
  const incomplete=metadata();incomplete.complete=false;assert.throws(()=>contentSegments(incomplete),/incomplete/);
  const gap=metadata();gap.frames[1].scrollTop=900;assert.throws(()=>contentSegments(gap),/gap/);
  const short=metadata();short.frames.pop();assert.throws(()=>contentSegments(short),/truncated/);
});

test('captured layers preserve 16:9 native pixels and constrain projections to selected rectangles',()=>{
  const svg=captureLayerSvg({id:'foreground',title:'Captured <screen>',image,width:1600,height:900,regions:[{x:40,y:100,width:300,height:200}]});
  assert.match(svg,/width="1920" height="1080" viewBox="0 0 1600 900"/);
  assert.match(svg,/<title>Captured &lt;screen&gt;<\/title>/);
  assert.match(svg,/foreground-regions/);assert.match(svg,/x="40" y="100" width="300" height="200"/);
  assert.match(svg,/<mask[^>]+maskUnits="userSpaceOnUse"[^>]+mask-type="alpha"/);
  assert.match(svg,/mask="url\(#foreground-regions\)"/);
  assert.match(svg,/data:image\/png;base64,AAAA/);
  assert.doesNotMatch(svg,/<script|<foreignObject|href="https?:/);
  assert.throws(()=>captureLayerSvg({id:'foreground',title:'x',image,width:1600,height:900,regions:[{x:1500,y:10,width:300,height:20}]}),/outside/);
});

const rectangles=svg=>[...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"\/>/g)].map(match=>{
  const [x,y,width,height]=match.slice(1).map(Number);return {x,y,width,height};
});
const contains=(rect,x,y)=>x>=rect.x&&y>=rect.y&&x<rect.x+rect.width&&y<rect.y+rect.height;
const layer=(regions,excludeRegions=[])=>captureLayerSvg({id:'test',title:'Test',image,width:1600,height:900,regions,excludeRegions});

test('lifting a panel removes its pixels from the lower plane without discarding its surroundings',()=>{
  const pieces=rectangles(layer([{x:0,y:0,width:1600,height:900}],[{x:400,y:200,width:800,height:300}]));
  assert.equal(pieces.reduce((area,rect)=>area+rect.width*rect.height,0),1600*900-800*300);
  assert.ok(!pieces.some(rect=>contains(rect,800,350)));
  for(const point of [[0,0],[1599,899],[399,350],[1200,350]])assert.ok(pieces.some(rect=>contains(rect,...point)));
});

test('nested and overlapping projections assign every point to exactly one highest layer',()=>{
  const selections=[
    [{x:0,y:0,width:1600,height:900}],
    [{x:200.5,y:150.5,width:1000,height:600}],
    [{x:800.5,y:100.5,width:600,height:400}],
    [{x:900.5,y:200.5,width:200,height:200},{x:300.5,y:300.5,width:100,height:100}]
  ];
  const generated=selections.map((regions,index)=>rectangles(layer(regions,selections.slice(index+1).flat())));
  for(let y=.5;y<900;y+=10)for(let x=.5;x<1600;x+=10){
    const expected=selections.findLastIndex(regions=>regions.some(rect=>contains(rect,x,y)));
    const owners=generated.flatMap((regions,index)=>regions.some(rect=>contains(rect,x,y))?[index]:[]);
    assert.deepEqual(owners,[expected],`Exclusive ownership at ${x}, ${y}`);
  }
  assert.match(layer(selections[0],selections.slice(1).flat()),/shape-rendering="crispEdges"/);
});

test('cutouts can fully cover a lower selection and must stay inside the captured viewport',()=>{
  const rect={x:100,y:100,width:100,height:100};
  assert.deepEqual(rectangles(layer([rect],[rect])),[]);
  assert.deepEqual(rectangles(layer([rect],[{x:500,y:500,width:100,height:100}])),[rect]);
  assert.throws(()=>layer([rect],[{x:1500,y:10,width:300,height:20}]),/outside/);
  assert.throws(()=>layer([rect],[{x:0,y:0,width:NaN,height:20}]),/outside/);
});

test('page-colored backing restores removed surfaces without repeating captured panel content',()=>{
  const svg=captureLayerSvg({id:'background',title:'Page',image,width:1600,height:900,regions:[{x:0,y:0,width:1600,height:900}],excludeRegions:[{x:400,y:200,width:800,height:300}],backingColor:'#fbf9f8'});
  assert.match(svg,/<g data-capture-backing="background" fill="#fbf9f8" shape-rendering="crispEdges"><rect x="0" y="0" width="1600" height="900"\/><\/g>/);
  assert.ok(svg.indexOf('data-capture-backing')<svg.indexOf('<image'));
  assert.equal((svg.match(/<image /g)||[]).length,1);
  const mask=svg.match(/<mask[\s\S]*?<\/mask>/)[0];
  assert.ok(!rectangles(mask).some(rect=>contains(rect,800,350)),'Source pixels remain excluded even though their backing is opaque');
});

test('backing stays inside selected panels and rejects unsafe or translucent colors',()=>{
  const input={id:'panel',title:'Panel',image,width:1600,height:900,regions:[{x:40,y:100,width:300,height:200}],excludeRegions:[{x:100,y:120,width:30,height:40}]};
  const svg=captureLayerSvg({...input,backingColor:'#F1EFED'});
  const backing=svg.match(/<g data-capture-backing=[\s\S]*?<\/g>/)[0];
  assert.deepEqual(rectangles(backing),input.regions);
  assert.doesNotMatch(captureLayerSvg(input),/data-capture-backing/,'Data-only overlays can remain transparent');
  for(const color of [42,['#ffffff'],{}])assert.throws(()=>captureLayerSvg({...input,backingColor:color}),/backing color/);
  for(const color of ['transparent','#fff','#ffffff00','url(#paint)','red','\" onload=\"x'])assert.throws(()=>captureLayerSvg({...input,backingColor:color}),/backing color/);
});

test('long source and fixed navigation keep their native pixel resolution',()=>{
  const m=metadata(),images=Object.fromEntries(m.frames.map(f=>[f.file,image]));
  const content=fullContentSvg(m,images);
  assert.match(content,/width="3200" height="3398" viewBox="0 0 1600 1699"/);
  assert.match(content,/Example &amp; report/);
  const footer=fixedRegionSvg(m,image,{name:'footer',rect:{x:0,y:844,width:1600,height:56}});
  assert.match(footer,/width="3200" height="112"/);assert.match(footer,/y="-844"/);
});

test('private captures are ignored and never appear in the published demo registry',async()=>{
  const ignore=await readFile(new URL('../.gitignore',import.meta.url),'utf8');
  assert.match(ignore,/^captures\/private\/$/m);assert.match(ignore,/^assets\/Private - \*\/$/m);
  const publicDemos=JSON.parse(await readFile(new URL('../assets/demos.json',import.meta.url),'utf8'));
  assert.ok(publicDemos.every(name=>!name.startsWith('Private - ')));
});
