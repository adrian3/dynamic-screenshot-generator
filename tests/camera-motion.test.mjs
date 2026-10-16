import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, PerspectiveCamera, Spherical, Vector3, MathUtils } from '../vendor/three/three.core.js';
import { defaultSettings, parseDemoConfig, normalizeSettings, layerOrder } from '../demo-config.js';
import { CAMERA_DISTANCE, FLY_IN_DURATION, PRESET_TRANSITION_DURATION, transitionWeight, blendCameraPose, flyInPose, isCameraTour, tourKeyframes, inversionKeyframes, cameraStartPose, tourStartPose, sampleCameraPose, sampleFlyIn, sampleInversion, snapshotCamera, captureDemoConfig } from '../camera-motion.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function cameraFor(pose,target=new Vector3(0,1.05,.05)){
  const camera=new PerspectiveCamera(pose.perspective,16/9,.05,60);
  camera.position.setFromSpherical(new Spherical(CAMERA_DISTANCE/pose.scale,(90-pose.rotateX)*Math.PI/180,pose.rotateY*Math.PI/180)).add(target);
  camera.lookAt(target);camera.rotateZ(pose.rotateZ*Math.PI/180);return {camera,target};
}

test('shared preset transition is bounded, eased and reaches its moving target exactly',()=>{
  assert.equal(PRESET_TRANSITION_DURATION,600);assert.equal(transitionWeight(-100),0);assert.equal(transitionWeight(0),0);assert.equal(transitionWeight(300),.5);assert.equal(transitionWeight(600),1);assert.equal(transitionWeight(1000),1);
  const from=tourKeyframes[2],to=flyInPose;
  assert.deepEqual(blendCameraPose(from,to,0),from);assert.deepEqual(blendCameraPose(from,to,1),to);
  for(let time=0;time<=600;time+=13){
    const pose=blendCameraPose(from,to,transitionWeight(time));
    for(const key of Object.keys(to))assert.ok(pose[key]>=Math.min(from[key],to[key])-1e-9&&pose[key]<=Math.max(from[key],to[key])+1e-9);
  }
});

test('retargeting a preset transition starts at the current visible pose, not a queued endpoint',()=>{
  const visible=blendCameraPose(tourKeyframes[2],flyInPose,transitionWeight(230));
  assert.deepEqual(blendCameraPose(visible,inversionKeyframes[0],transitionWeight(0)),visible);
  assert.deepEqual(blendCameraPose(visible,inversionKeyframes[0],transitionWeight(600)),inversionKeyframes[0]);
});

test('Sway preserves the original sinusoid for each axis, including paused phase',()=>{
  for(const axis of ['x','y','z']){
    const state=defaultSettings();state.animation.axis=axis;
    const pose=sampleCameraPose(state.scene,state.animation,state.animation.speed/4);
    const key=`rotate${axis.toUpperCase()}`;close(pose[key],state.scene[key]+state.animation.angle);
    assert.deepEqual(sampleCameraPose(state.scene,state.animation,state.animation.speed/4),pose);
    close(sampleCameraPose(state.scene,state.animation,state.animation.speed)[key],state.scene[key]);
  }
});

test('Camera Tour holds each supplied pose for three seconds and transitions for one',()=>{
  const state=defaultSettingsWithTour();
  const expected=[
    {perspective:34,rotateX:11.524650957490238,rotateY:-48.241042498426836,rotateZ:0,scale:1.6499999999999997},
    {perspective:34,rotateX:0,rotateY:-3.7595800583949104,rotateZ:0,scale:1.65},
    {perspective:34,rotateX:22.06710587686571,rotateY:38.4036117501247,rotateZ:0,scale:1.4082867632347056}
  ];
  assert.equal(state.animation.duration,12000);
  for(const [index,time] of [0,4000,8000,12000].entries()){
    const pose=sampleCameraPose(state.scene,state.animation,time);
    for(const key of Object.keys(expected[0]))close(pose[key],expected[index%3][key]);
    assert.deepEqual(sampleCameraPose(state.scene,state.animation,time+1500),pose);
    assert.deepEqual(sampleCameraPose(state.scene,state.animation,time+3000),pose);
    const half=sampleCameraPose(state.scene,state.animation,time+3500);
    for(const key of Object.keys(expected[0]))close(half[key],(expected[index%3][key]+expected[(index+1)%3][key])/2);
  }
  assert.deepEqual(state,defaultSettingsWithTour());
});
function defaultSettingsWithTour(){const state=defaultSettings();state.animation.preset='tour';state.scene={...tourKeyframes[0]};return state;}

function defaultSettingsWithInversion(){const state=defaultSettings();state.animation.preset='inversion';state.scene=cameraStartPose('inversion','laptop');return state;}

test('Inversion uses its own two captured poses without changing Camera Tour',()=>{
  const state=defaultSettingsWithInversion(),white=1-new Color('#fdfdfd').r;
  assert.equal(isCameraTour('inversion'),true);assert.equal(isCameraTour('sway'),false);
  for(const [time,index] of [[0,0],[4500,0],[6000,1],[10500,1],[12000,0]]){
    const pose=sampleCameraPose(state.scene,state.animation,time);
    for(const key of Object.keys(pose))close(pose[key],inversionKeyframes[index][key]);
  }
  close(sampleInversion(inversionKeyframes[0].rotateY),white);close(sampleInversion(inversionKeyframes[1].rotateY),1);
  close(sampleInversion((inversionKeyframes[0].rotateY+inversionKeyframes[1].rotateY)/2),(white+1)/2);
  close(sampleInversion(-90),white);close(sampleInversion(90),1);
  assert.deepEqual(cameraStartPose('tour','laptop'),tourStartPose('laptop'));
  assert.deepEqual(cameraStartPose('inversion','desktop'),inversionKeyframes[0]);
});

test('Inversion endpoints reconstruct the supplied world positions and quaternions exactly',()=>{
  const positions=[[-5.280529860372599,2.3908515071731467,4.992881951136895],[4.598112757598178,2.383564388223286,5.635062707286761]];
  const orientations=[[-.08396508121054806,-.39621164571316775,-.036414664047873364,.9135864322442896],[-.08567524278804321,.3362212416354437,.03073034423512393,.937374351787759]];
  inversionKeyframes.forEach((pose,index)=>{
    const {camera}=cameraFor(pose);
    camera.position.toArray().forEach((value,i)=>close(value,positions[index][i]));
    camera.quaternion.toArray().forEach((value,i)=>close(value,orientations[index][i]));
  });
});

test('Inversion finish is continuous on both transitions and across the loop boundary',()=>{
  const state=defaultSettingsWithInversion();
  const blend=time=>sampleInversion(sampleCameraPose(state.scene,state.animation,time).rotateY);
  for(const time of [0,4500,6000,10500,12000])close(blend(time-.01),blend(time+.01),1e-8);
  assert.ok(blend(5250)>0&&blend(5250)<1);assert.ok(blend(11250)>0&&blend(11250)<1);
  close(blend(0),blend(12000));
});

test('Inversion capture includes the visible finish without overwriting the saved body color',()=>{
  const state=defaultSettingsWithInversion();
  const original=structuredClone(state);
  for(const [time,color] of [[0,'#fdfdfd'],[6000,'#000000'],[12000,'#fdfdfd']]){
    const {camera,target}=cameraFor(sampleCameraPose(state.scene,state.animation,time));
    const json=captureDemoConfig(state,{},camera,target);
    assert.equal(json.capture.bodyColor,color);assert.equal(json.laptop.bodyColor,state.laptop.bodyColor);
    assert.equal(parseDemoConfig(json).settings.animation.preset,'inversion');
  }
  assert.deepEqual(state,original);
});

test('desktop starts at the capture while laptop starts wider with the same angles',()=>{
  const desktop=tourStartPose('desktop'),laptop=tourStartPose('laptop');
  assert.deepEqual(desktop,tourKeyframes[0]);assert.equal(laptop.scale,1.24);
  for(const key of ['perspective','rotateX','rotateY','rotateZ'])close(laptop[key],desktop[key]);
  desktop.rotateY=0;assert.equal(tourStartPose('desktop').rotateY,-48.241042498426836);
});

test('authored camera poses reconstruct the captured world positions and orientations',()=>{
  const positions=[[-3.5438253511024125,2.2186764563463512,3.2139805830300685],[-.31791502487753454,1.2500000000000002,4.888050781352368],[3.2703058416259703,3.384180514503327,4.175564823100917]];
  const quaternions=[[-.09163577611757161,-.40659240882037445,-.04103005774306683,.9080760056220936],[-2.2886027104076173e-17,-.03280263972665958,-7.511263215435647e-19,.9994618486100224],[-.1807363663959882,.32281685234741175,.06294544924874719,.9269096590937856]];
  tourKeyframes.forEach((pose,index)=>{
    const {camera}=cameraFor(pose,new Vector3(0,1.25,.05));
    camera.position.toArray().forEach((value,i)=>close(value,positions[index][i]));
    camera.quaternion.toArray().forEach((value,i)=>close(value,quaternions[index][i]));
  });
});

test('bounded easing never overshoots the captured horizon, yaw or zoom',()=>{
  const state=defaultSettingsWithTour();
  for(let time=0;time<=state.animation.duration;time+=37){
    const pose=sampleCameraPose(state.scene,state.animation,time);
    for(const key of Object.keys(state.scene)){
      const values=tourKeyframes.map(frame=>frame[key]);
      assert.ok(pose[key]>=Math.min(...values)-1e-9&&pose[key]<=Math.max(...values)+1e-9,`${key} at ${time}`);
    }
  }
});

test('manual camera arrangement reanchors the authored route without changing its first pose',()=>{
  const state=defaultSettingsWithTour(),arranged={perspective:38,rotateX:18,rotateY:-25,rotateZ:5,scale:1.1};
  const start=sampleCameraPose(arranged,state.animation,0);
  for(const key of Object.keys(arranged))close(start[key],arranged[key]);
});

test('tour value and velocity are continuous at its keyframes and closing boundary',()=>{
  const state=defaultSettingsWithTour(),duration=state.animation.duration,epsilon=.01;
  for(const t of [0,3000,4000,7000,8000,11000,duration]){
    const before=sampleCameraPose(state.scene,state.animation,t-epsilon),at=sampleCameraPose(state.scene,state.animation,t),after=sampleCameraPose(state.scene,state.animation,t+epsilon);
    for(const key of ['rotateX','rotateY','rotateZ','perspective','scale']){
      close(before[key],after[key],.001);
      close((at[key]-before[key])/epsilon,(after[key]-at[key])/epsilon,1e-7);
    }
  }
});

test('Fly In starts at the captured angle and sways during and after its entrance',()=>{
  const state=defaultSettings();state.scene={...flyInPose};state.animation.preset='fly-in';
  const before=structuredClone(state);
  assert.deepEqual(sampleCameraPose(state.scene,state.animation,0),flyInPose);
  for(const time of [250,500,1000,2250,4500,10000]){
    const pose=sampleCameraPose(state.scene,state.animation,time);
    close(pose.rotateY,flyInPose.rotateY+Math.sin(time/state.animation.speed*Math.PI*2)*state.animation.angle);
    for(const key of ['perspective','rotateX','rotateZ','scale'])close(pose[key],flyInPose[key]);
  }
  const {camera}=cameraFor(flyInPose);
  const position=[-2.4825825089922886,2.501355155502888,3.95360828268256];
  camera.position.toArray().forEach((value,i)=>close(value,position[i]));
  assert.deepEqual(state,before);
});

test('Fly In sway supports every axis, remains continuous at entrance completion and preserves phase when speed changes',()=>{
  const state=defaultSettings();state.scene={...flyInPose};state.animation.preset='fly-in';
  for(const axis of ['x','y','z']){
    const animation={...state.animation,axis},key=`rotate${axis.toUpperCase()}`;
    close(sampleCameraPose(state.scene,animation,animation.speed/4)[key],state.scene[key]+animation.angle);
    const time=725,slower={...animation,speed:18000};
    assert.deepEqual(sampleCameraPose(state.scene,animation,time),sampleCameraPose(state.scene,slower,time*slower.speed/animation.speed));
    const epsilon=.001,before=sampleCameraPose(state.scene,animation,1000-epsilon),at=sampleCameraPose(state.scene,animation,1000),after=sampleCameraPose(state.scene,animation,1000+epsilon);
    close((at[key]-before[key])/epsilon,(after[key]-at[key])/epsilon,1e-8);
  }
});

test('Fly In settles progressively separated, enlarged layers in exactly one second',()=>{
  assert.equal(FLY_IN_DURATION,1000);
  let previousDepth=0,previousScale=1;
  for(let index=0;index<4;index++){
    const start=sampleFlyIn(0,index),half=sampleFlyIn(500,index),end=sampleFlyIn(1000,index);
    assert.equal(start.deviceOpacity,0);assert.ok(start.depthOffset>previousDepth);assert.ok(start.scale>previousScale);
    close(half.deviceOpacity,.5);close(half.depthOffset,start.depthOffset/2);close(half.scale,1+(start.scale-1)/2);
    assert.deepEqual(end,{deviceOpacity:1,depthOffset:0,scale:1});
    assert.deepEqual(sampleFlyIn(10000,index),end);assert.deepEqual(sampleFlyIn(-100,index),start);
    previousDepth=start.depthOffset;previousScale=start.scale;
  }
});

test('tour duration rescales time and camera poses stay within the front orbit limits',()=>{
  const state=defaultSettingsWithTour(),longer={...state.animation,duration:90000};
  assert.deepEqual(sampleCameraPose(state.scene,state.animation,state.animation.duration/4),sampleCameraPose(state.scene,longer,longer.duration/4));
  for(const scene of [state.scene,{...state.scene,rotateX:0,rotateY:-90},{...state.scene,rotateX:70,rotateY:90}])for(let time=0;time<state.animation.duration;time+=113){
    const pose=sampleCameraPose(scene,state.animation,time);
    assert.ok(Object.values(pose).every(Number.isFinite));assert.ok(pose.rotateX>=0&&pose.rotateX<=70);assert.ok(pose.rotateY>=-90&&pose.rotateY<=90);
  }
});

test('camera snapshots recover exact visible angles, roll, FOV, scale and target',()=>{
  for(const roll of [0,12,-15,32]){
    const pose={perspective:41,rotateX:17.25,rotateY:-37.125,rotateZ:roll,scale:1.13},target=new Vector3(.1,1.25,-.2),{camera}=cameraFor(pose,target),captured=snapshotCamera(camera,target);
    for(const key of Object.keys(pose))close(captured[key],pose[key]);
    assert.deepEqual(captured.position,camera.position.toArray());assert.deepEqual(captured.target,target.toArray());assert.deepEqual(captured.quaternion,camera.quaternion.toArray());
    close(captured.aspect,16/9);
  }
});

test('copied JSON records the visible animated frame without changing live settings',()=>{
  const state=defaultSettingsWithTour();state.canvas.assetSet='Music demo';state.laptop.x=.2;state.layers.foreground.rotateZ=7;state.animation.time=7312;
  const before=structuredClone(state),visible=sampleCameraPose(state.scene,state.animation,state.animation.time),{camera,target}=cameraFor(visible);
  const files=Object.fromEntries(layerOrder.map((key,index)=>[key,`${index}.svg`]));
  const json=captureDemoConfig(state,files,camera,target),restored=parseDemoConfig(JSON.parse(JSON.stringify(json)));
  assert.equal(json.capture.demo,'Music demo');for(const key of Object.keys(visible))close(json.capture.camera[key],visible[key]);
  assert.notEqual(json.capture.camera.rotateY,state.scene.rotateY);assert.deepEqual(restored.settings,normalizeSettings(state));assert.deepEqual(restored.files,files);assert.deepEqual(state,before);
  close(MathUtils.radToDeg(camera.position.clone().sub(target).angleTo(new Vector3(0,1,0))),90-json.capture.camera.rotateX);
});
