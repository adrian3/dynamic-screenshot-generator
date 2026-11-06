import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,basename,dirname} from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {defaultSettings,normalizeSettings,layerOrder,layerNames,demoConfigFromState} from '../demo-config.js';
import {captureLayerSvg,fullContentSvg,fixedRegionSvg} from './capture-svg.mjs';

const {values}=parseArgs({options:{capture:{type:'string'},layout:{type:'string'},output:{type:'string'}}});
if(!values.capture||!values.layout||!values.output)throw new Error('Usage: node tools/build-captured-demo.mjs --capture captures/private/run --layout layout.json --output "assets/Private - Example"');
const source=resolve(values.capture),output=resolve(values.output);
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
if(dirname(output)!==resolve(projectRoot,'assets')||!basename(output).startsWith('Private - '))throw new Error('Captured demos must be written to the project assets/Private - NAME folder so the default git-ignore rule protects them.');
if((await readdir(output).catch(e=>{if(e.code==='ENOENT')return [];throw e;})).length)throw new Error('Demo output already exists; choose a new folder.');
const metadata=JSON.parse(await readFile(join(source,'capture.json'),'utf8')),layout=JSON.parse(await readFile(resolve(values.layout),'utf8'));
if(!metadata.complete)throw new Error('Only complete captures can become demos.');
if(Math.abs(metadata.viewport.width/metadata.viewport.height-16/9)>.001)throw new Error('Capture a 16:9 viewport for these laptop/desktop demos.');
const images={};
for(const frame of metadata.frames){
  if(basename(frame.file)!==frame.file)throw new Error('Capture image filenames must be local to the capture folder.');
  const bytes=await readFile(join(source,frame.file));
  if(bytes.subarray(1,4).toString()!=='PNG'||bytes.readUInt32BE(16)!==frame.width||bytes.readUInt32BE(20)!==frame.height)throw new Error('Capture image dimensions do not match their manifest.');
  images[frame.file]=`data:image/png;base64,${bytes.toString('base64')}`;
}
const image=images[metadata.frames[0].file];
const settings=normalizeSettings(layout.settings,defaultSettings());
for(const [index,key] of layerOrder.entries()){
  settings.layers[key].z=[0,.12,.24,.36][index];settings.layers[key].scale=.96;
}
const files=Object.fromEntries(layerOrder.map((key,index)=>[key,`${layerNames[index]}.svg`]));
const pageColor=layout.pageColor??'#ffffff';
const backingColors=Object.fromEntries(layerOrder.map(key=>[key,layout.backingColors?.[key]??pageColor]));
const generated=layerOrder.map((key,index)=>{
  const regions=index===0?[{x:0,y:0,width:metadata.viewport.width,height:metadata.viewport.height}]:layout.layers?.[key];
  if(!Array.isArray(regions)||!regions.length)throw new Error(`Choose at least one rectangle for ${key}.`);
  const excludeRegions=layerOrder.slice(index+1).flatMap(higher=>layout.layers?.[higher]||[]);
  return {file:files[key],svg:captureLayerSvg({id:key,title:`${layout.title}: ${layerNames[index]}`,image,width:metadata.viewport.width,height:metadata.viewport.height,regions,excludeRegions,backingColor:backingColors[key]})};
});
const content=fullContentSvg(metadata,images);
await mkdir(output,{recursive:true});
for(const asset of generated)await writeFile(join(output,asset.file),asset.svg);
await writeFile(join(output,'demo.json'),JSON.stringify(demoConfigFromState(settings,files),null,2)+'\n');
await writeFile(join(output,'capture-layout.json'),JSON.stringify({version:1,source,title:metadata.title,url:metadata.url,capturedAt:metadata.capturedAt,viewport:metadata.viewport,scroll:metadata.scroll,fixedRegions:metadata.fixedRegions,layers:layout.layers,pageColor,backingColors,format:'image-backed SVG',baseScreen:'Higher-layer content is removed from lower layers and replaced with page-colored backing; each captured panel appears only once.'},null,2)+'\n');
await writeFile(join(source,'full-content.svg'),content);
for(const fixed of metadata.fixedRegions)await writeFile(join(source,`${fixed.name}.svg`),fixedRegionSvg(metadata,image,fixed));
console.log(`Created ${output}: four 1920 x 1080 self-contained SVG layers and full editor settings.`);
console.log(`Saved ${metadata.scroll.rect.width} x ${metadata.scroll.contentHeight} scroll content plus fixed header/footer in ${source}.`);
