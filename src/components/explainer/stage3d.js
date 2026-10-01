import * as THREE from 'three'

// The live 3D backdrop behind the demo player's scenes: a perspective grid
// floor that fades into the distance, glowing rings and particles, and soft
// brand-coloured lights. The camera swings to a new angle on every scene.

const NAVY = 0x0a2450
const BLUE = 0x6fa8f5
const RED = 0xc8102e

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

function backdropTexture() {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 512
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, '#081a3c')
    grad.addColorStop(0.55, '#123b78')
    grad.addColorStop(1, '#0a2450')
    g.fillStyle = grad
    g.fillRect(0, 0, 16, 512)
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
    scene.background = backdropTexture()
    scene.fog = new THREE.Fog(NAVY, 14, 46)

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 120)

    // Grid floor.
    const grid = new THREE.GridHelper(120, 60, 0x6fa8f5, 0x2d5aa0)
    grid.material.transparent = true
    grid.material.opacity = 0.32
    grid.position.y = -3.2
    scene.add(grid)

    // Glow pools on the floor (red top-right, blue bottom-left like the 2D design).
    const glow = glowTexture()
    const pool = (color, x, z, size, opacity) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }))
        m.rotation.x = -Math.PI / 2
        m.position.set(x, -3.15, z)
        scene.add(m)
        return m
    }
    pool(RED, 9, -10, 22, 0.35)
    pool(BLUE, -9, 2, 20, 0.4)

    // Floating rings.
    const rings = []
    const ringSpec = [
        [-7.5, 1.8, -8, 2.2, BLUE],
        [8.5, 3.2, -12, 3.0, RED],
        [6.5, -1.2, -4, 1.3, BLUE],
        [-10, 4.5, -16, 3.6, BLUE],
    ]
    for (const [x, y, z, r, color] of ringSpec) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, 96), mat)
        ring.position.set(x, y, z)
        ring.rotation.set(Math.random() * 1.2, Math.random() * 1.2, 0)
        ring.userData.spin = (Math.random() - 0.5) * 0.4
        scene.add(ring)
        rings.push(ring)
    }

    // Soft floating orbs.
    const orbs = []
    for (let i = 0; i < 7; i++) {
        const mat = new THREE.SpriteMaterial({ map: glow, color: i % 3 === 0 ? RED : BLUE, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
        const s = new THREE.Sprite(mat)
        const size = 0.8 + Math.random() * 1.6
        s.scale.set(size, size, 1)
        s.position.set(-14 + Math.random() * 28, -1 + Math.random() * 7, -6 - Math.random() * 16)
        s.userData.phase = Math.random() * Math.PI * 2
        s.userData.baseY = s.position.y
        scene.add(s)
        orbs.push(s)
    }

    // Particles drifting upward.
    const count = 260
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const speed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
        pos[i * 3] = -20 + Math.random() * 40
        pos[i * 3 + 1] = -3 + Math.random() * 12
        pos[i * 3 + 2] = -24 + Math.random() * 26
        speed[i] = 0.15 + Math.random() * 0.4
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const particles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: glow, color: 0xcfe2ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }))
    scene.add(particles)

    // Camera: orbit angle per scene, eased.
    const cam = { angle: 0, targetAngle: 0, height: 1.2, targetHeight: 1.2, radius: 12 }
    const pointer = { x: 0, y: 0 }
    let active = true
    let elapsed = 0
    let frame = 0
    const clock = new THREE.Clock()

    const tick = () => {
        frame = requestAnimationFrame(tick)
        const dt = Math.min(0.1, clock.getDelta())
        if (!active) return
        elapsed += dt
        cam.angle += (cam.targetAngle - cam.angle) * Math.min(1, dt * 1.4)
        cam.height += (cam.targetHeight - cam.height) * Math.min(1, dt * 1.4)
        const a = cam.angle + Math.sin(elapsed * 0.15) * 0.05 + pointer.x * 0.06
        camera.position.set(Math.sin(a) * cam.radius, cam.height - pointer.y * 0.5, Math.cos(a) * cam.radius)
        camera.lookAt(Math.sin(a) * -4, 0.8, Math.cos(a) * -4)

        grid.position.z = (elapsed * 0.6) % 2
        rings.forEach((r) => { r.rotation.y += r.userData.spin * dt; r.rotation.x += r.userData.spin * 0.5 * dt })
        orbs.forEach((o) => { o.position.y = o.userData.baseY + Math.sin(elapsed * 0.6 + o.userData.phase) * 0.4 })
        const arr = geo.attributes.position.array
        for (let i = 0; i < count; i++) {
            arr[i * 3 + 1] += speed[i] * dt
            if (arr[i * 3 + 1] > 9) arr[i * 3 + 1] = -3
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
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    tick()

    return {
        // A different camera angle for each scene (alternating sides).
        setScene(index) {
            const side = index % 2 === 0 ? 1 : -1
            cam.targetAngle = side * (0.12 + (index % 3) * 0.07)
            cam.targetHeight = 0.6 + (index % 3) * 0.7
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
                if (o.material) o.material.dispose()
            })
            glow.dispose()
            scene.background?.dispose?.()
            renderer.dispose()
            renderer.domElement.remove()
        },
    }
}
