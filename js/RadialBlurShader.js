/**
 * @author John Turesson
 */

THREE.RadialBlurShader = {

    uniforms: {

        "tDiffuse": {
            type: "t",
            value: null
        },

    },

    vertexShader: document.getElementById('v-shader-radial').textContent,

    fragmentShader: document.getElementById('f-shader-radial').textContent

};