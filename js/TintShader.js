/**
 * @author John Turesson
 */

THREE.TintShader = {

    uniforms: {

        "tDiffuse": {
            type: "t",
            value: null
        },

        "tint": {
            type: "f",
            value: 0
        },

    },

    vertexShader: document.getElementById('v-shader-tint').textContent,

    fragmentShader: document.getElementById('f-shader-tint').textContent

};