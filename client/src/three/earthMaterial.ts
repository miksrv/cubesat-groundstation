import * as THREE from 'three'

/**
 * Day/night blended Earth material. Mixes a daylight texture with a
 * night-lights texture based on the angle between the surface normal and a
 * fixed sun direction, so the globe shows a realistic terminator line as it
 * rotates underneath a stationary "sun".
 */
export const createEarthMaterial = (dayTexture: THREE.Texture, nightTexture: THREE.Texture): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
        uniforms: {
            dayTexture: { value: dayTexture },
            nightTexture: { value: nightTexture },
            sunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() }
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
