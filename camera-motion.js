import { Color, MathUtils, Matrix4, Quaternion, Spherical } from './vendor/three/three.core.js';
import { controlSpecs, demoConfigFromState } from './demo-config.js';

export const CAMERA_DISTANCE=8;
export const FLY_IN_DURATION=1000;
export const PRESET_TRANSITION_DURATION=600;
export const flyInPose=Object.freeze({perspective:34,rotateX:17.418086464214824,rotateY:-32.45518613469482,rotateZ:0,scale:1.65});
const sceneLimits=Object.fromEntries(controlSpecs.scene.map(([key,,min,max])=>[key,[min,max]]));
// Authored visible camera poses, including the Sway offset present in the captures.
export const tourKeyframes=Object.freeze([
  Object.freeze({perspective:34,rotateX:11.524650957490238,rotateY:-48.241042498426836,rotateZ:0,scale:1.6499999999999997}),
  Object.freeze({perspective:34,rotateX:0,rotateY:-3.7595800583949104,rotateZ:0,scale:1.65}),
  Object.freeze({perspective:34,rotateX:22.06710587686571,rotateY:38.4036117501247,rotateZ:0,scale:1.4082867632347056})
]);
export const inversionKeyframes=Object.freeze([
  Object.freeze({perspective:34,rotateX:10.502273787313399,rotateY:-46.89161613805969,rotateZ:0,scale:1.087515179232779}),
  Object.freeze({perspective:34,rotateX:10.444554570895505,rotateY:39.46420242537315,rotateZ:0,scale:1.0875151792327815})
]);
const inversionWhite=new Color('#fdfdfd').r;

export function transitionWeight(time) {
  return MathUtils.smootherstep(time,0,PRESET_TRANSITION_DURATION);
}

export function blendCameraPose(from,to,weight) {
  return Object.fromEntries(controlSpecs.scene.map(([key])=>[key,MathUtils.lerp(from[key],to[key],weight)]));
}

export function tourStartPose(device='desktop') {
  const pose={...tourKeyframes[0]};
  // The captures use the desktop; the deeper laptop base needs a wider starting view.
  if(device==='laptop')pose.scale=Math.round(pose.scale*.75*100)/100;
  return pose;
}

export function isCameraTour(preset) {
  return preset==='tour'||preset==='inversion';
}

export function cameraStartPose(preset,device) {
  return preset==='inversion'?{...inversionKeyframes[0]}:tourStartPose(device);
}

export function sampleInversion(yaw) {
  const weight=MathUtils.clamp((yaw-inversionKeyframes[0].rotateY)/(inversionKeyframes[1].rotateY-inversionKeyframes[0].rotateY),0,1);
  return MathUtils.lerp(1-inversionWhite,1,weight);
}

export function sampleCameraPose(scene,animation,time) {
  const pose={...scene};
  if(isCameraTour(animation.preset)){
    const keyframes=animation.preset==='inversion'?inversionKeyframes:tourKeyframes;
    const phase=MathUtils.euclideanModulo(time,animation.duration)/animation.duration;
    const segment=phase*keyframes.length,index=Math.floor(segment);
    const from=keyframes[index],to=keyframes[(index+1)%keyframes.length],anchor=keyframes[0];
    // Quintic easing keeps the horizon/maximum zoom bounded and velocity/acceleration continuous.
    // Each segment holds for 75% of its time, then transitions for the last 25%.
    const weight=MathUtils.smootherstep(segment-index,.75,1);
    for(const [key,[min,max]] of Object.entries(sceneLimits)){
      const value=MathUtils.lerp(from[key],to[key],weight);
      pose[key]=MathUtils.clamp(key==='scale'?scene[key]*value/anchor[key]:scene[key]+value-anchor[key],min,max);
    }
  }else if(animation.preset==='sway'||animation.preset==='fly-in'){
    const wave=Math.sin(time/animation.speed*Math.PI*2)*animation.angle;
    if(animation.axis==='x')pose.rotateX+=wave;
    else if(animation.axis==='z')pose.rotateZ+=wave;
    else pose.rotateY+=wave;
    pose.rotateX=MathUtils.clamp(pose.rotateX,...sceneLimits.rotateX);
    pose.rotateY=MathUtils.clamp(pose.rotateY,...sceneLimits.rotateY);
  }
  return pose;
}

export function sampleFlyIn(time,index=0) {
  const progress=MathUtils.smootherstep(time,0,FLY_IN_DURATION),remaining=1-progress;
  return {deviceOpacity:progress,depthOffset:(.35+index*.6)*remaining,scale:1+(.65+index*.3)*remaining};
}

export function snapshotCamera(camera,target) {
  const offset=camera.position.clone().sub(target),spherical=new Spherical().setFromVector3(offset);
  const unrolled=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(camera.position,target,camera.up));
  const roll=unrolled.invert().multiply(camera.quaternion);
  return {
    perspective:camera.fov,
    rotateX:90-MathUtils.radToDeg(spherical.phi),
    rotateY:MathUtils.radToDeg(spherical.theta),
    rotateZ:MathUtils.euclideanModulo(MathUtils.radToDeg(2*Math.atan2(roll.z,roll.w))+180,360)-180,
    scale:CAMERA_DISTANCE*Math.max(1,1/camera.aspect)/spherical.radius,
    position:camera.position.toArray(),target:target.toArray(),quaternion:camera.quaternion.toArray(),aspect:camera.aspect
  };
}

export function captureDemoConfig(state,files,camera,target) {
  const capture={demo:state.canvas.assetSet||'',camera:snapshotCamera(camera,target)};
  if(state.animation.preset==='inversion'){
    const lightness=1-sampleInversion(capture.camera.rotateY);
    capture.bodyColor=`#${new Color().setRGB(lightness,lightness,lightness).getHexString()}`;
  }
  return {...demoConfigFromState(state,files),capture};
}
