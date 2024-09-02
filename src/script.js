import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import GUI from 'lil-gui'
import particlesVertexShader from './shaders/particles/vertex.glsl'
import particlesFragmentShader from './shaders/particles/fragment.glsl'
import gpgpuParticles from './shaders/gpgpu/particles.glsl'
import { GPUComputationRenderer } from 'three/examples/jsm/Addons.js'

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 })
const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Loaders
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Materials
    particles.material.uniforms.uResolution.value.set(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 10000)
// camera.position.set(4.5, 4, 11)

camera.position.set(300,10,0)



camera.rotateX(-1)
// camera.lookAt(491,8,190)

scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

debugObject.clearColor = '#ffffff'
renderer.setClearColor(debugObject.clearColor)

const gltf = await gltfLoader.loadAsync('./statue33.glb')


//** base Geometry */

const baseGeometry = {}

// gltf.scene.children[0].position.set(0,0,0)
//  gltf.scene.children[0].scale.set(0.0000000001,0.0000000001,0.0000000001)
gltf.scene.children[0].scale.set(1,1,1)
 console.log(gltf.scene.children[0].position)
 console.log(gltf.scene.children[0].scale)
baseGeometry.instance = gltf.scene.children[0].geometry
baseGeometry.count = baseGeometry.instance.attributes.position.count


//** GpuCompute */

const gpgpu = {}
gpgpu.size = Math.ceil(Math.sqrt(baseGeometry.count))
gpgpu.computation = new GPUComputationRenderer(gpgpu.size,gpgpu.size,renderer)

const baseParticlesTexture = gpgpu.computation.createTexture()

for(let i = 0 ; i < baseGeometry.count;i++){
    const i3 =  i  * 3 
    const i4 =  i * 4

    //position based on Geometry
    baseParticlesTexture.image.data[i4 + 0] = baseGeometry.instance.attributes.position.array[i3 + 0]
    baseParticlesTexture.image.data[i4 + 1] = baseGeometry.instance.attributes.position.array[i3 + 1]
    baseParticlesTexture.image.data[i4 + 2] = baseGeometry.instance.attributes.position.array[i3 + 2]
    baseParticlesTexture.image.data[i4 + 3] = Math.random()

}   



gpgpu.particlesVariable = gpgpu.computation.addVariable('uParticles',gpgpuParticles,baseParticlesTexture)
gpgpu.computation.setVariableDependencies(gpgpu.particlesVariable, [gpgpu.particlesVariable])

//uniforms 
gpgpu.particlesVariable.material.uniforms.uTIme = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0)
gpgpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform( baseParticlesTexture )
gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence = new THREE.Uniform( 100 )
gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength = new THREE.Uniform( 100 )
gpgpu.particlesVariable.material.uniforms.uFlowFIeldFrequency = new THREE.Uniform( 0.1)

gpgpu.computation.init()

//debug 
gpgpu.debug = new THREE.Mesh(
    new THREE.PlaneGeometry(3,3),
    new THREE.MeshBasicMaterial({map: gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture})
)
gpgpu.debug.position.x = 3 


/**
 * Particles
 */
const particles = {}



// Geometry

const particlesUvArray = new Float32Array(baseGeometry.count * 2)
const sizesArray = new Float32Array(baseGeometry.count)

for(let y = 0 ; y < gpgpu.size; y++){
    for(let x = 0 ; x < gpgpu.size;x++) {
        const i = (y * gpgpu.size + x)
        const i2 = i * 2

        const  uvX = (x + 0.5)  / gpgpu.size
        const  uvY = (y + 0.5) / gpgpu.size

        particlesUvArray[i2 + 0]  = uvX
        particlesUvArray[i2 + 1] = uvY

        sizesArray[i] = Math.random()

    }
}

console.log(particlesUvArray);

particles.geometry = new THREE.BufferGeometry()
particles.geometry.setDrawRange(0, baseGeometry.count)
particles.geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(particlesUvArray, 2))
// particles.geometry.setAttribute('aColor', baseGeometry.instance.attributes.color)
particles.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray,1))


// Material
particles.material = new THREE.ShaderMaterial({
    vertexShader: particlesVertexShader,
    fragmentShader: particlesFragmentShader,
    uniforms:
    {
        uSize: new THREE.Uniform(0.07),
        uResolution: new THREE.Uniform(new THREE.Vector2(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)),
        uParticlesTexture: new THREE.Uniform()
    }
})

// Points
particles.points = new THREE.Points(particles.geometry, particles.material)
scene.add(particles.points)

/**
 * Tweaks
 */
gui.addColor(debugObject, 'clearColor').onChange(() => { renderer.setClearColor(debugObject.clearColor) })
gui.add(particles.material.uniforms.uSize, 'value').min(0).max(1).step(0.001).name('uSize')
gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence, 'value')
    .min(0)
    .max(5000)
    .name('uFlowFieldInfluence')

    gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength, 'value')
    .min(0)
    .max(100)
    .name('uFlowFieldStrenght') 

    gui
    .add(gpgpu.particlesVariable.material.uniforms.uFlowFIeldFrequency, 'value')
    .min(0)
    .max(100)
    .step(0.001)
    .name('uFlowFIeldFrequency')

  
/**
 * Animate
 */
const clock = new THREE.Clock()
let previousTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime
    
    // Update controls
    controls.update()
    console.log(camera.position)
  

    // console.log(camera.rotation)

    //Gpgpu update

    gpgpu.particlesVariable.material.uniforms.uTIme.value = elapsedTime
      gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime  
      gpgpu.computation.compute()
    particles.material.uniforms.uParticlesTexture.value = gpgpu.computation.getCurrentRenderTarget(gpgpu.particlesVariable).texture

    // Render normal scene
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()