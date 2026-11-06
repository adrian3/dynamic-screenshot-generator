import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readdir,readFile,copyFile,stat,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {collectCaptureMetadata,scrollPositions} from './capture-layout.mjs';

const exec=promisify(execFile),sleep=ms=>new Promise(done=>setTimeout(done,ms));
const options={url:{type:'string'},output:{type:'string'},width:{type:'string',default:'1600'},height:{type:'string',default:'900'},'download-dir':{type:'string',default:join(homedir(),'Downloads')},'max-tiles':{type:'string',default:'12'}};
const {values}=parseArgs({options});
if(!values.url||!values.output)throw new Error('Usage: node tools/capture-chrome.mjs --url https://example.com/page --output captures/private/example');
if(process.platform!=='darwin')throw new Error('Live Chrome capture currently requires macOS.');
const requested=new URL(values.url);
if(!['https:','http:'].includes(requested.protocol))throw new Error('Capture an HTTP or HTTPS page.');
if(requested.username||requested.password)throw new Error('Use a signed-in browser tab, not credentials in the URL.');
const output=resolve(values.output),width=Number(values.width),height=Number(values.height),maxTiles=Number(values['max-tiles']);
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
if(!output.startsWith(resolve(projectRoot,'captures/private')+sep))throw new Error('Save authorized real-app captures below the project captures/private/ folder so they stay out of the public repository.');
if((await readdir(output).catch(error=>{if(error.code==='ENOENT')return [];throw error;})).length)throw new Error('Capture output already contains files. Choose a new output folder to keep existing captures intact.');
if(!Number.isInteger(width)||!Number.isInteger(height)||width<640||width>2560||height<400||height>1600||!Number.isInteger(maxTiles)||maxTiles<1||maxTiles>30)throw new Error('Invalid capture dimensions or tile limit.');
const quote=value=>JSON.stringify(value);
async function apple(script){return (await exec('osascript',['-e',script],{maxBuffer:8*1024*1024,timeout:30000})).stdout.trim();}
const match=await apple(`tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if URL of t is ${quote(requested.href)} then return (id of w as text) & "," & (id of t as text)
    end repeat
  end repeat
  return ""
end tell`);
if(!/^\d+,\d+$/.test(match))throw new Error('Open this exact URL in your signed-in Chrome session first.');
const [windowId,tabId]=match.split(',');
const activeIndex=Number(await apple(`tell application "Google Chrome" to return active tab index of window id ${windowId}`));
async function evaluate(expression){return JSON.parse(await apple(`tell application "Google Chrome" to tell tab id ${tabId} of window id ${windowId} to execute javascript ${quote(`JSON.stringify(${expression})`)}`));}
const bounds=(await apple(`tell application "Google Chrome" to return bounds of window id ${windowId}`)).split(',').map(Number);
const before=await evaluate(`({url:location.href,width:innerWidth,height:innerHeight})`);
const updated=[bounds[0],bounds[1],bounds[0]+width+(bounds[2]-bounds[0]-before.width),bounds[1]+height+(bounds[3]-bounds[1]-before.height)];
const devtoolsTitle=`DevTools - ${requested.host}${requested.pathname}`;
const filePrefix=requested.host;
async function screenshot(name){
  const candidates=async()=>new Set((await readdir(values['download-dir'])).filter(name=>name.startsWith(filePrefix)&&name.endsWith('.png')));
  const existing=await candidates();
  await apple(`tell application "System Events" to tell process "Google Chrome"
    set frontmost to true
    key code 53
    set w to first window whose name starts with ${quote(devtoolsTitle)}
    perform action "AXRaise" of w
    set value of attribute "AXMain" of w to true
    set p to position of w
    click at {(item 1 of p) + 150, (item 2 of p) + 12}
    keystroke "p" using {command down, shift down}
    delay 0.6
    keystroke "a" using {command down}
    key code 51
    key code 47 using {shift down}
    delay 0.1
    keystroke "Capture screenshot"
    delay 0.5
    key code 36
  end tell`);
  for(let tries=0;tries<60;tries++){
    for(const file of await candidates())if(!existing.has(file)){
      const path=join(values['download-dir'],file),size=(await stat(path)).size;
      if(size>24){await sleep(250);if((await stat(path)).size===size){const bytes=await readFile(path);if(bytes.subarray(1,4).toString()!=='PNG')throw new Error('Chrome did not save a PNG.');await copyFile(path,join(output,name));return {file:name,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};}}
    }
    await sleep(250);
  }
  throw new Error('Screenshot was not found. Check the download folder and keep DevTools undocked; no Save As prompt should be open.');
}

await mkdir(output,{recursive:true});
try{
  await apple(`tell application "Google Chrome"
    tell window id ${windowId}
      repeat with i from 1 to count of tabs
        if id of tab i as text is ${quote(tabId)} then set active tab index to i
      end repeat
    end tell
  end tell`);
  await apple(`tell application "Google Chrome" to set bounds of window id ${windowId} to {${updated.join(',')}}`);
  await sleep(600);
  const metadata=await evaluate(`(${collectCaptureMetadata.toString()})()`);
  if(metadata.viewport.width!==width||metadata.viewport.height!==height)throw new Error(`Chrome provided ${metadata.viewport.width} x ${metadata.viewport.height}; disable device emulation or use dimensions that fit the display.`);
  const rect=metadata.scroll.rect,positions=scrollPositions(metadata.scroll.contentHeight,rect.height,{maxTiles});
  metadata.frames=[];
  for(const [index,y] of positions.entries()){
    if(await evaluate('location.href')!==requested.href)throw new Error('The page changed during capture. No complete capture manifest was saved.');
    const actual=await evaluate(`(()=>{window.__livingCapture.scroller.scrollTop=${y};return window.__livingCapture.scroller.scrollTop;})()`);
    await sleep(500);
    const image=await screenshot(index===0?'viewport.png':`scroll-${String(index).padStart(2,'0')}.png`);
    metadata.frames.push({...image,scrollTop:actual});
    console.log(`Captured ${image.file}: ${image.width} x ${image.height}, scroll ${actual}`);
  }
  const finalHeight=await evaluate('window.__livingCapture.scroller.scrollHeight');
  metadata.complete=metadata.frames.at(-1).scrollTop+rect.height>=finalHeight;
  if(!metadata.complete)throw new Error('The page grew while loading. Wait for content to settle and capture into a new folder.');
  await writeFile(join(output,'capture.json'),JSON.stringify(metadata,null,2)+'\n');
  console.log(`Saved ${metadata.frames.length} frames and scroll/header/footer metadata in ${output}`);
}finally{
  await evaluate(`(()=>{const c=window.__livingCapture;if(c){c.scroller.scrollTop=c.top;c.scroller.scrollLeft=c.left;delete window.__livingCapture;}return true;})()`).catch(()=>{});
  await apple(`tell application "Google Chrome" to set bounds of window id ${windowId} to {${bounds.join(',')}}`).catch(()=>{});
  await apple(`tell application "Google Chrome" to set active tab index of window id ${windowId} to ${activeIndex}`).catch(()=>{});
}
