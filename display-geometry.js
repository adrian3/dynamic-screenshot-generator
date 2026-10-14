import * as THREE from 'three';

export function roundedOutline(width, height, bottomRadius, topRadius, centerY=0) {
  const left=-width/2,right=width/2,bottom=-height/2-centerY,top=height/2-centerY;
  const shape=new THREE.Shape();
  shape.moveTo(left+bottomRadius,bottom);shape.lineTo(right-bottomRadius,bottom);
  shape.absarc(right-bottomRadius,bottom+bottomRadius,bottomRadius,-Math.PI/2,0,false);
  shape.lineTo(right,top-topRadius);shape.absarc(right-topRadius,top-topRadius,topRadius,0,Math.PI/2,false);
  shape.lineTo(left+topRadius,top);shape.absarc(left+topRadius,top-topRadius,topRadius,Math.PI/2,Math.PI,false);
  shape.lineTo(left,bottom+bottomRadius);shape.absarc(left+bottomRadius,bottom+bottomRadius,bottomRadius,Math.PI,Math.PI*1.5,false);
  shape.closePath();return shape;
}

export function roundedPlane(width, height, radius, topRadius=radius) {
  const geometry=new THREE.ShapeGeometry(roundedOutline(width,height,radius,topRadius),16);
  const positions=geometry.attributes.position;
  const uv=new Float32Array(positions.count*2);
  for(let i=0;i<positions.count;i++){uv[i*2]=positions.getX(i)/width+.5;uv[i*2+1]=positions.getY(i)/height+.5;}
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return geometry;
}

export function displayShell(width, height, depth, bottomRadius, topRadius, bevel, material) {
  const geometry=new THREE.ExtrudeGeometry(roundedOutline(width,height,bottomRadius,topRadius),{depth:depth-2*bevel,steps:1,curveSegments:16,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3});
  geometry.translate(0,0,-depth/2+bevel);
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}
