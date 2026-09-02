import * as THREE from 'three'

/**
 * Day/night blended Earth material.
 *
 * Mixes a daylight texture with a night-lights texture by the angle between the
 * surface normal and `sunDirection`, so the globe carries a terminator with a
 * soft edge a few degrees wide.
 *
 * **`sunDirection` is written by the scene, not fixed here.** It used to be the
 * constant `(1, 0.3, 0.5)` — a subsolar point of 15.0° N, 26.6° W, which is
 * about 13:46 UTC in mid-June, and the globe does not rotate either, so the
 * terminator sat there permanently whatever the clock said. It now comes from
 * `features/orbit/sun.ts` for the instant on display: the wall clock live and in
 * the `yarn demo` replay, the playhead while a mission is being replayed. The
 * uniform is overwritten rather than the material rebuilt, because rebuilding it
 * would recompile the shader every time the clock moved.
 *
 * The vector is in the same frame as `three/geo.ts`'s `latLonToVector3`, and is
 * produced by that function, so the lit half cannot drift away from the
 * geography under it.
 */
export const createEarthMaterial = (dayTexture: THREE.Texture, nightTexture: THREE.Texture): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
        uniforms: {
            dayTexture: { value: dayTexture },
            nightTexture: { value: nightTexture },
            // Replaced before the first frame; see the note above.
            sunDirection: { value: new THREE.Vector3(1, 0, 0) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldNormal;

            void main() {
                vUv = uv;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D dayTexture;
            uniform sampler2D nightTexture;
            uniform vec3 sunDirection;
            varying vec2 vUv;
            varying vec3 vWorldNormal;

            void main() {
                vec3 dayColor = texture2D(dayTexture, vUv).rgb;
                vec3 nightColor = texture2D(nightTexture, vUv).rgb * 1.4;
                float intensity = dot(normalize(vWorldNormal), normalize(sunDirection));
                float mixFactor = smoothstep(-0.15, 0.15, intensity);
                gl_FragColor = vec4(mix(nightColor, dayColor, mixFactor), 1.0);
            }
        `
    })
