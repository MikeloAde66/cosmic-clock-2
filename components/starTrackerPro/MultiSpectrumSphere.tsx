'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SKY_SURVEYS, type SkySurveyId } from '@/lib/starTrackerPro/skySurveys';
import { DOME_RADIUS } from './CelestialSphere';

// Real weighted cross-fade between the available real survey textures (see
// lib/starTrackerPro/skySurveys.ts) — a genuine GLSL fragment shader, not a
// CSS opacity trick layering two <img>s. Backdrop sphere sits just outside
// the star dome radius (BackSide-rendered, since the camera is inside it),
// so the star instancedMesh always renders in front of it.
const BACKDROP_RADIUS = DOME_RADIUS * 1.5;

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// weightOptical/weightInfrared/weightHAlpha are independent 0-1 opacity
// sliders, not a fixed 3-way crossfade — normalizing by their sum (guarded
// against 0) means any combination (all three partially on, two off, etc.)
// still blends sensibly instead of over- or under-exposing.
const FRAGMENT_SHADER = `
  uniform sampler2D texOptical;
  uniform sampler2D texInfrared;
  uniform sampler2D texHAlpha;
  uniform float weightOptical;
  uniform float weightInfrared;
  uniform float weightHAlpha;
  varying vec2 vUv;

  void main() {
    vec3 optical = texture2D(texOptical, vUv).rgb;
    vec3 infrared = texture2D(texInfrared, vUv).rgb;
    vec3 hAlpha = texture2D(texHAlpha, vUv).rgb;
    float total = max(weightOptical + weightInfrared + weightHAlpha, 0.0001);
    vec3 blended = (optical * weightOptical + infrared * weightInfrared + hAlpha * weightHAlpha) / total;
    gl_FragColor = vec4(blended, 1.0);
  }
`;

export interface SpectrumWeights {
  optical: number;
  infrared: number;
  hAlpha: number;
}

function useSurveyTexture(id: SkySurveyId): THREE.Texture {
  const texture = useMemo(() => {
    const definition = SKY_SURVEYS[id];
    const loader = new THREE.TextureLoader();
    // Unavailable surveys (see skySurveys.ts — currently hAlpha) get a
    // flat black 1x1 texture rather than a request to a nonexistent proxy
    // path; its weight is expected to stay at 0 in the UI until a real
    // source is confirmed, so its actual pixel content never matters.
    if (!definition.available) {
      const data = new Uint8Array([0, 0, 0, 255]);
      const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    }
    const tex = loader.load(`/api/skySurveys/${id}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [id]);

  // Created via TextureLoader/DataTexture outside the JSX tree, so R3F's
  // auto-dispose never tracks it — same leak this shares with
  // CelestialSphere's glow sprite texture.
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  return texture;
}

export default function MultiSpectrumSphere({ weights }: { weights: SpectrumWeights }) {
  const texOptical = useSurveyTexture('optical');
  const texInfrared = useSurveyTexture('infrared');
  const texHAlpha = useSurveyTexture('hAlpha');

  const uniforms = useMemo(
    () => ({
      texOptical: { value: texOptical },
      texInfrared: { value: texInfrared },
      texHAlpha: { value: texHAlpha },
      weightOptical: { value: weights.optical },
      weightInfrared: { value: weights.infrared },
      weightHAlpha: { value: weights.hAlpha },
    }),
    // Textures are stable for the component's lifetime (each survey ID
    // never changes which texture object it maps to); only the weight
    // uniforms need to track live prop changes after creation, done below
    // via direct uniform mutation rather than rebuilding the material.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  uniforms.weightOptical.value = weights.optical;
  uniforms.weightInfrared.value = weights.infrared;
  uniforms.weightHAlpha.value = weights.hAlpha;

  return (
    <mesh>
      <sphereGeometry args={[BACKDROP_RADIUS, 64, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
