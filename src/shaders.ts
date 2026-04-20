// Atmosphere shader

export const atmVertSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vNormal;
out vec3 vWorldPos;

void main() {
  vec4 wp = uModel * vec4(aPosition, 1.0);
  vWorldPos = wp.xyz;
  vNormal   = mat3(uModel) * aNormal;
  gl_Position = uProjection * uView * wp;
}
`;

export const atmFragSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;

uniform vec3  uAtmColor;
uniform vec3  uCameraPos;
uniform float uAtmStrength;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 L = normalize(-vWorldPos); // toward sun at origin

  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  float lit = max(dot(N, L), 0.0);

  float glow = rim * (lit * 0.88 + 0.06);
  fragColor = vec4(uAtmColor, glow * uAtmStrength);
}
`;

// Phong shader

export const phongVertSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vLocalPos;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal   = mat3(uModel) * aNormal;
  vLocalPos = aPosition;
  gl_Position = uProjection * uView * worldPos;
}
`;

export const phongFragSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vLocalPos;

uniform vec3  uColor;
uniform vec3  uSecondaryColor;
uniform vec3  uLightPos;
uniform vec3  uCameraPos;
uniform float uShininess;
uniform float uTime;
uniform int   uPatternType;
uniform float uBumpIntensity;

uniform vec3  uOccluderPositions[9];
uniform float uOccluderRadii[9];
uniform int   uThisPlanet;

out vec4 fragColor;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i),          hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 5; i++) {
    v    += amp * valueNoise(p * freq);
    amp  *= 0.5;
    freq *= 2.1;
  }
  return v;
}

vec3 surfaceColor() {

  if (uPatternType == 1) {
    // Gas giant
    float warp  = fbm(vLocalPos * 2.0) * 0.45;
    float y     = vLocalPos.y + warp;
    float bands = sin(y * 12.0) * 0.5 + 0.5;
          bands += sin(y * 30.0 + warp * 4.0) * 0.20;
          bands += sin(y * 68.0) * 0.08;
    float stormDist = length(vec2(vLocalPos.x - 0.3, vLocalPos.y + 0.1)) * 3.5;
    float storm = smoothstep(1.0, 0.0, stormDist) * 0.25;
    return mix(uColor, uSecondaryColor, clamp(bands + storm, 0.0, 1.0));

  } else if (uPatternType == 2) {
    // Ice giant
    float swirl = fbm(vLocalPos * 2.5 + vec3(0, uTime * 0.01, 0));
    float bands = sin(vLocalPos.y * 10.0 + swirl * 4.0) * 0.5 + 0.5;
          bands  = mix(bands, fbm(vLocalPos * 4.0), 0.3);
    return mix(uColor, uSecondaryColor, bands * 0.5);

  } else if (uPatternType == 3) {
    // Earth
    float continental = fbm(vLocalPos * 3.2);
    float detail      = fbm(vLocalPos * 7.0) * 0.35;
    float land        = smoothstep(0.42, 0.60, continental + detail);

    vec3 deepOcean  = vec3(0.04, 0.18, 0.52);
    vec3 shallowSea = vec3(0.10, 0.38, 0.72);
    vec3 terrain    = mix(uSecondaryColor * 0.75, uSecondaryColor, fbm(vLocalPos * 9.0));
    vec3 col = mix(mix(deepOcean, shallowSea, fbm(vLocalPos * 5.0) * 0.6), terrain, land);

    float pole = smoothstep(0.68, 0.88, abs(vLocalPos.y));
    col = mix(col, vec3(0.93, 0.96, 1.00), pole);

    float cloud = smoothstep(0.55, 0.75, fbm(vLocalPos * 4.5 + vec3(uTime * 0.008, 0, 0)));
    col = mix(col, vec3(0.90, 0.92, 0.95), cloud * 0.35);

    return col;

  } else {
    // Rocky
    float base   = fbm(vLocalPos * 3.5);
    float detail = fbm(vLocalPos * 9.0)  * 0.40;
    float fine   = fbm(vLocalPos * 22.0) * 0.15;
    float n = clamp(base + detail + fine, 0.0, 1.0);
    float rim = smoothstep(0.48, 0.55, n) * (1.0 - smoothstep(0.55, 0.65, n));
    vec3 col = mix(uColor, uSecondaryColor, n * 0.7);
    return col + rim * vec3(0.08);
  }
}

float shadowFactor() {
  vec3 toSun    = -vWorldPos;
  float sunDist = length(toSun);
  vec3 L        = toSun / sunDist;
  for (int i = 0; i < 9; i++) {
    if (i == uThisPlanet) continue;
    vec3  oc   = vWorldPos - uOccluderPositions[i];
    float b    = dot(oc, L);
    float c    = dot(oc, oc) - uOccluderRadii[i] * uOccluderRadii[i];
    float disc = b * b - c;
    if (disc > 0.0) {
      float t = -b - sqrt(disc);
      if (t > 0.05 && t < sunDist) return 0.15;
    }
  }
  return 1.0;
}

void main() {
  float eps = 0.03;
  float dnx = fbm(vLocalPos + vec3(eps,0,0)) - fbm(vLocalPos - vec3(eps,0,0));
  float dny = fbm(vLocalPos + vec3(0,eps,0)) - fbm(vLocalPos - vec3(0,eps,0));
  float dnz = fbm(vLocalPos + vec3(0,0,eps)) - fbm(vLocalPos - vec3(0,0,eps));
  vec3 N = normalize(vNormal + uBumpIntensity * vec3(dnx, dny, dnz));

  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 R = reflect(-L, N);

  vec3 sc = surfaceColor();

  float shadow = shadowFactor();

  vec3 ambient  = 0.028 * sc;
  vec3 diffuse  = shadow * max(dot(N, L), 0.0) * sc * 1.15;
  vec3 specCol  = mix(uColor * 0.6, vec3(1.0), 0.25);
  vec3 specular = shadow * pow(max(dot(R, V), 0.0), uShininess) * specCol * 0.45;

  float fresnel    = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  float rimFacing  = smoothstep(-0.10, 0.45, dot(N, L));
  vec3  rimColor   = uColor * 1.6 + vec3(0.04, 0.07, 0.12);
  vec3  rim        = fresnel * rimColor * 0.32 * rimFacing;

  fragColor = vec4(ambient + diffuse + specular + rim, 1.0);
}
`;

// Bloom shaders

export const quadVertSrc = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUV;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const brightExtractFragSrc = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
out vec4 fragColor;
void main() {
  vec3 c = texture(uScene, vUV).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = smoothstep(0.68, 0.90, lum);
  fragColor = vec4(c * knee, 1.0);
}
`;

export const blurFragSrc = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2      uDir;
out vec4 fragColor;

const float W[7] = float[](0.1062,0.1006,0.0856,0.0652,0.0447,0.0276,0.0154);

void main() {
  vec3 col = texture(uTex, vUV).rgb * W[0];
  for (int i = 1; i < 7; i++) {
    col += texture(uTex, vUV + uDir * float(i)).rgb * W[i];
    col += texture(uTex, vUV - uDir * float(i)).rgb * W[i];
  }
  fragColor = vec4(col, 1.0);
}
`;

// Composite
export const compositeFragSrc = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float     uStrength;
out vec4 fragColor;
void main() {
  vec3 scene = texture(uScene, vUV).rgb;
  vec3 bloom = texture(uBloom, vUV).rgb;
  vec3 color = scene + bloom * uStrength;

  color = color / (1.0 + color * 0.85);
  color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
  float vignette = 1.0 - smoothstep(0.38, 1.05, length((vUV - 0.5) * vec2(1.0, 1.15)));
  color *= mix(0.55, 1.0, vignette);
  float grain = fract(sin(dot(vUV * 812.0, vec2(127.1, 311.7))) * 43758.5);
  color += (grain - 0.5) * 0.018;

  fragColor = vec4(color, 1.0);
}
`;

// Ring shader

export const ringVertSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3  aPosition;
in float aRadial;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out float vRadial;

void main() {
  vRadial     = aRadial;
  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}
`;

export const ringFragSrc = /* glsl */ `#version 300 es
precision highp float;

in float vRadial;

uniform vec3  uRingColor;
uniform float uAlpha;

out vec4 fragColor;

void main() {
  float fade = smoothstep(0.0, 0.06, vRadial) * (1.0 - smoothstep(0.94, 1.0, vRadial));
  float gap  = smoothstep(0.55, 0.575, vRadial) * (1.0 - smoothstep(0.575, 0.62, vRadial));
  float bands = 0.65 + 0.35 * sin(vRadial * 90.0) * sin(vRadial * 23.0 + 1.4);
  float alpha = fade * (1.0 - gap * 0.92) * bands * uAlpha;
  fragColor = vec4(uRingColor, alpha);
}
`;

// Unlit shader

export const unlitVertSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3  vLocalPos;
out float vStarSize;

void main() {
  vLocalPos   = aPosition;

  float h = fract(sin(dot(aPosition, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vStarSize   = 1.0 + h * 2.2;
  gl_PointSize = vStarSize;

  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}
`;

export const unlitFragSrc = /* glsl */ `#version 300 es
precision highp float;

in vec3  vLocalPos;
in float vStarSize;

uniform vec3  uColor;
uniform float uAlpha;
uniform float uTime;
uniform bool  uIsSun;

out vec4 fragColor;

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float valueNoise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash3(i),          hash3(i+vec3(1,0,0)),f.x),
        mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
        mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),
    f.z);
}

void main() {
  if (uIsSun) {
    vec3 p = vLocalPos;
    float n1 = valueNoise3(p * 3.0 + vec3(uTime * 0.18, 0, uTime * 0.11));
    float n2 = valueNoise3(p * 7.0 - vec3(0, uTime * 0.25, uTime * 0.14));
    float n3 = valueNoise3(p * 15.0 + vec3(uTime * 0.35, uTime * 0.20, 0));
    float turbulence = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

    float spot = smoothstep(0.28, 0.42, turbulence);
    vec3 core    = vec3(1.00, 0.98, 0.72);
    vec3 mid     = vec3(1.00, 0.65, 0.05);
    vec3 sunspot = vec3(0.55, 0.18, 0.02);

    vec3 col = mix(sunspot, mix(mid, core, turbulence), spot);

    float limb = 1.0 - smoothstep(0.55, 1.0, length(vLocalPos));
    col *= mix(0.55, 1.0, limb);

    fragColor = vec4(col, 1.0);

  } else if (uAlpha > 0.8) {
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;

    float brightness = smoothstep(0.5, 0.0, dist);

    float tint = hash3(vLocalPos * 0.01);
    vec3 starColor = mix(vec3(0.75, 0.85, 1.00), vec3(1.00, 0.95, 0.80), tint) * uColor;
    float dimmer = 0.45 + 0.55 * hash3(vLocalPos * 0.1);

    fragColor = vec4(starColor * brightness * dimmer, 1.0);

  } else {
    fragColor = vec4(uColor, uAlpha);
  }
}
`;
