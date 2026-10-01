import * as THREE from 'three'
import campusPhoto from '../../assets/footer-building.jpg'

// The live 3D backdrop behind the demo player's scenes: the Holy Cross of
// Davao College building, on a surface with depth (the street in front is
// nearer than the rooftops), so as the camera drifts, sways and changes angle
// per scene the building moves with real perspective -- like a slow drone
// shot. A navy tint with darker edges keeps the scene cards readable.

const NAVY = 0x0a2450
const PHOTO_ASPECT = 1080 / 569

function glowTexture() {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
}

// Navy tint: lighter in the middle, darker at the edges and bottom.
function tintTexture() {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 288
    const g = c.getContext('2d')
    const radial = g.createRadialGradient(256, 130, 40, 256, 144, 330)
    radial.addColorStop(0, 'rgba(10, 36, 80, 0.52)')
    radial.addColorStop(1, 'rgba(6, 20, 46, 0.86)')
    g.fillStyle = radial
    g.fillRect(0, 0, 512, 288)
    const bottom = g.createLinearGradient(0, 160, 0, 288)
    bottom.addColorStop(0, 'rgba(6, 20, 46, 0)')
    bottom.addColorStop(1, 'rgba(6, 20, 46, 0.45)')
    g.fillStyle = bottom
    g.fillRect(0, 0, 512, 288)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
}

export function createStage3d(container) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(NAVY)

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200)
    scene.add(camera)

    // ---- The campus photo on a surface with depth -----------------------------
    const PHOTO_H = 36
    const PHOTO_W = PHOTO_H * PHOTO_ASPECT
    const photoGeo = new THREE.PlaneGeometry(PHOTO_W, PHOTO_H, 64, 36)
    {
        // Street (bottom) comes forward, rooftops (top) recede; the middle
        // (the facade) bulges a little toward the viewer.
        const p = photoGeo.attributes.position
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) / (PHOTO_W / 2)
            const y = p.getY(i) / (PHOTO_H / 2)
            const z = -y * 4.2 + (1 - x * x) * 1.6
            p.setZ(i, z)
        }
        photoGeo.computeVertexNormals()
    }
    const photoMat = new THREE.MeshBasicMaterial({ color: 0x8aa0c4, toneMapped: false })
    const photo = new THREE.Mesh(photoGeo, photoMat)
    photo.position.set(0, 0, -22)
    scene.add(photo)

    new THREE.TextureLoader().load(campusPhoto, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        photoMat.map = texture
        photoMat.color.set(0xffffff)
        photoMat.needsUpdate = true
    })

    // Tint fixed to the camera, so it always covers the view.
    const tintMat = new THREE.MeshBasicMaterial({ map: tintTexture(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false })
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tintMat)
    tint.renderOrder = 10
    camera.add(tint)

    // Light dust drifting upward, in front of the building.
    const glow = glowTexture()
    const count = 160
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const speed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
        pos[i * 3] = -22 + Math.random() * 44
        pos[i * 3 + 1] = -10 + Math.random() * 20
        pos[i * 3 + 2] = -14 + Math.random() * 18
        speed[i] = 0.12 + Math.random() * 0.3
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.13, map: glow, color: 0xdbe7ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }))
    dust.renderOrder = 11
    scene.add(dust)

    // ---- Camera: a framing per scene, eased, plus a slow drone drift ---------
    const cam = { x: 0, y: 0, z: 14, tx: 0, ty: 0, tz: 14 }
    const look = { x: 0, y: 0, tx: 0, ty: 0 }
    const pointer = { x: 0, y: 0 }
    let active = true
    let elapsed = 0
    let frame = 0
    const clock = new THREE.Clock()

    // A few framings that keep the facade in view.
    const FRAMINGS = [
        { x: 0, y: 0.5, z: 14, lx: 0, ly: 0 },
        { x: -5, y: 2.2, z: 12, lx: -2, ly: 1 },
        { x: 5, y: 1, z: 12.5, lx: 2.5, ly: 0.5 },
        { x: -2, y: -1.5, z: 11, lx: -1, ly: -1.5 },
        { x: 4, y: 3, z: 13, lx: 1.5, ly: 2 },
        { x: 0, y: 1.6, z: 10.5, lx: 0, ly: 1 },
    ]

    const tick = () => {
        frame = requestAnimationFrame(tick)
        const dt = Math.min(0.1, clock.getDelta())
        if (!active) return
        elapsed += dt
        const ease = Math.min(1, dt * 0.9)
        cam.x += (cam.tx - cam.x) * ease
        cam.y += (cam.ty - cam.y) * ease
        cam.z += (cam.tz - cam.z) * ease
        look.x += (look.tx - look.x) * ease
        look.y += (look.ty - look.y) * ease

        // Slow drone drift: a gentle push in and a figure-eight sway.
        const push = Math.sin(elapsed * 0.12) * 0.9
        camera.position.set(
            cam.x + Math.sin(elapsed * 0.21) * 0.9 + pointer.x * 1.1,
            cam.y + Math.sin(elapsed * 0.17) * 0.5 - pointer.y * 0.7,
            cam.z - push,
        )
        camera.lookAt(look.x + pointer.x * 0.4, look.y - pointer.y * 0.25, -22)

        const arr = geo.attributes.position.array
        for (let i = 0; i < count; i++) {
            arr[i * 3 + 1] += speed[i] * dt
            if (arr[i * 3 + 1] > 10) arr[i * 3 + 1] = -10
        }
        geo.attributes.position.needsUpdate = true

        renderer.render(scene, camera)
    }

    const resize = () => {
        const w = container.clientWidth || 1
        const h = container.clientHeight || 1
        renderer.setSize(w, h, false)
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        // Size the tint to fill the view at its distance.
        const d = 1
        const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d
        tint.scale.set(vh * camera.aspect * 1.02, vh * 1.02, 1)
        tint.position.set(0, 0, -d)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    tick()

    return {
        // A different camera framing for each scene.
        setScene(index) {
            const f = FRAMINGS[index % FRAMINGS.length]
            cam.tx = f.x
            cam.ty = f.y
            cam.tz = f.z
            look.tx = f.lx
            look.ty = f.ly
        },
        setPointer(x, y) { pointer.x = x; pointer.y = y },
        setActive(value) {
            active = value
            if (value) clock.getDelta()
        },
        dispose() {
            cancelAnimationFrame(frame)
            ro.disconnect()
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose()
                if (o.material) {
                    if (o.material.map) o.material.map.dispose()
                    o.material.dispose()
                }
            })
            glow.dispose()
            renderer.dispose()
            renderer.domElement.remove()
        },
    }
}
