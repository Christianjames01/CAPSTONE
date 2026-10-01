import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import QRCode from 'qrcode'
import hcdcLogo from '../../assets/hcdc-logo.png'

// The landing hero's 3D certificate: a softly curved academic certificate
// that floats, follows the pointer, catches a light sweep, gets its gold seal
// stamped when the request is ready, and a holographic "Verified" badge when
// it's claimed. setStage(i) follows the hero's status cycle:
//   0-2 receipt / payment / processing  -> draft
//   3   ready for claiming              -> seal stamped
//   4   completed                       -> verified

const PAPER_W = 3.4
const PAPER_H = 2.4
const TEX_W = 2048
const TEX_H = Math.round((TEX_W * PAPER_H) / PAPER_W)

const NAVY = '#123b78'
const GOLD = '#b8892b'
const INK = '#14213d'

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3)
const popIn = (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
    })
}

// ---- The certificate face (canvas) ------------------------------------------
function drawCertificate(g, { seal, qr, draft }) {
    const w = TEX_W
    const h = TEX_H

    // Paper with a faint warm gradient and fibres.
    const paper = g.createLinearGradient(0, 0, w, h)
    paper.addColorStop(0, '#fffdf7')
    paper.addColorStop(1, '#f6f0e1')
    g.fillStyle = paper
    g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.05
    for (let i = 0; i < 900; i++) {
        g.fillStyle = i % 2 ? '#b8a77f' : '#ffffff'
        g.fillRect((i * 7919) % w, (i * 104729) % h, 2 + (i % 5), 1)
    }
    g.globalAlpha = 1

    // Guilloche border band.
    const m = 46
    g.fillStyle = NAVY
    g.fillRect(m, m, w - m * 2, h - m * 2)
    g.fillStyle = '#fffdf7'
    const band = 54
    g.fillRect(m + band, m + band, w - (m + band) * 2, h - (m + band) * 2)
    g.save()
    g.beginPath()
    g.rect(m, m, w - m * 2, h - m * 2)
    g.rect(m + band, m + band, w - (m + band) * 2, h - (m + band) * 2)
    g.clip('evenodd')
    g.strokeStyle = 'rgba(230, 196, 120, 0.75)'
    g.lineWidth = 2
    for (let k = 0; k < 6; k++) {
        const phase = (k * Math.PI) / 3
        const along = (len, fn) => {
            g.beginPath()
            for (let t = 0; t <= len; t += 6) fn(t, Math.sin(t / 22 + phase) * (band / 2 - 6))
            g.stroke()
        }
        along(w, (t, s) => (t === 0 ? g.moveTo(t, m + band / 2 + s) : g.lineTo(t, m + band / 2 + s)))
        along(w, (t, s) => (t === 0 ? g.moveTo(t, h - m - band / 2 + s) : g.lineTo(t, h - m - band / 2 + s)))
        along(h, (t, s) => (t === 0 ? g.moveTo(m + band / 2 + s, t) : g.lineTo(m + band / 2 + s, t)))
        along(h, (t, s) => (t === 0 ? g.moveTo(w - m - band / 2 + s, t) : g.lineTo(w - m - band / 2 + s, t)))
    }
    g.restore()
    // Thin gold inner rule.
    g.strokeStyle = GOLD
    g.lineWidth = 4
    g.strokeRect(m + band + 22, m + band + 22, w - (m + band + 22) * 2, h - (m + band + 22) * 2)

    // Corner ornaments.
    const corner = (x, y, sx, sy) => {
        g.save()
        g.translate(x, y)
        g.scale(sx, sy)
        g.strokeStyle = GOLD
        g.lineWidth = 5
        g.beginPath()
        g.moveTo(0, 70)
        g.quadraticCurveTo(0, 0, 70, 0)
        g.moveTo(14, 70)
        g.quadraticCurveTo(14, 14, 70, 14)
        g.stroke()
        g.fillStyle = GOLD
        g.beginPath()
        g.arc(26, 26, 7, 0, Math.PI * 2)
        g.fill()
        g.restore()
    }
    const ci = m + band + 34
    corner(ci, ci, 1, 1)
    corner(w - ci, ci, -1, 1)
    corner(ci, h - ci, 1, -1)
    corner(w - ci, h - ci, -1, -1)

    const center = w / 2
    const text = (str, y, size, { font = 'Fraunces, Georgia, serif', weight = 700, color = INK, italic = false, spacing = 0 } = {}) => {
        g.fillStyle = color
        g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`
        g.fillText(str, center, y)
        if ('letterSpacing' in g) g.letterSpacing = '0px'
    }

    // Header with the school seal.
    if (seal.logo) g.drawImage(seal.logo, center - 85, 196, 170, 170)
    text('HOLY CROSS OF DAVAO COLLEGE', 420, 54, { spacing: 6, color: NAVY })
    text('Office of Registration & Records Management', 482, 30, { font: 'Inter, Arial, sans-serif', weight: 600, color: '#5b6b82', spacing: 2 })

    text('CERTIFICATION', 600, 104, { color: NAVY, spacing: 14 })
    g.fillStyle = GOLD
    g.fillRect(center - 230, 668, 460, 4)

    text('This is to certify that', 740, 34, { font: 'Inter, Arial, sans-serif', weight: 500, color: '#4b5565' })
    text('Juan Dela Cruz', 840, 104, { italic: true, color: INK })
    g.fillStyle = 'rgba(20, 33, 61, 0.35)'
    g.fillRect(center - 420, 900, 840, 3)
    text('has satisfactorily completed all academic requirements for the degree of', 960, 32, { font: 'Inter, Arial, sans-serif', weight: 500, color: '#4b5565' })
    text('Bachelor of Science in Information Technology', 1030, 50, { color: NAVY })
    text('Given this 2nd day of October, 2026, at Davao City, Philippines.', 1100, 28, { font: 'Inter, Arial, sans-serif', weight: 500, color: '#6b7280' })

    // Signature (left).
    const sx = 520
    g.strokeStyle = '#1f3a6b'
    g.lineWidth = 4
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(sx - 150, 1225)
    g.bezierCurveTo(sx - 110, 1160, sx - 80, 1260, sx - 40, 1205)
    g.bezierCurveTo(sx - 10, 1165, sx + 20, 1250, sx + 60, 1200)
    g.bezierCurveTo(sx + 90, 1170, sx + 110, 1235, sx + 160, 1190)
    g.stroke()
    g.fillStyle = 'rgba(20, 33, 61, 0.45)'
    g.fillRect(sx - 210, 1250, 420, 3)
    g.fillStyle = INK
    g.font = '700 30px Fraunces, Georgia, serif'
    g.textAlign = 'center'
    g.fillText('University Registrar', sx, 1290)

    // QR (right) -- real, scannable verify link.
    if (qr.canvas) {
        const size = 230
        const qx = w - 520 - size / 2
        const qy = 1060
        g.fillStyle = '#ffffff'
        g.fillRect(qx - 12, qy - 12, size + 24, size + 24)
        g.drawImage(qr.canvas, qx, qy, size, size)
        g.fillStyle = '#5b6b82'
        g.font = '600 24px "JetBrains Mono", Consolas, monospace'
        g.textAlign = 'center'
        g.fillText('CERT-000124', qx + size / 2, qy + size + 36)
    }

    // Draft watermark while it's still being processed.
    if (draft) {
        g.save()
        g.translate(center, h / 2 + 40)
        g.rotate(-0.32)
        g.fillStyle = 'rgba(200, 16, 46, 0.09)'
        g.font = '800 230px Fraunces, Georgia, serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('DRAFT', 0, 0)
        g.restore()
    }
}

// The embossed face of the gold seal.
function drawSealFace(g, size) {
    const c = size / 2
    const grad = g.createRadialGradient(c * 0.7, c * 0.6, size * 0.05, c, c, c)
    grad.addColorStop(0, '#fff0b8')
    grad.addColorStop(0.45, '#e6b54a')
    grad.addColorStop(1, '#9a6b14')
    g.fillStyle = grad
    g.beginPath()
    for (let k = 0; k < 48; k++) {
        const r = k % 2 ? c * 0.94 : c
        const a = (k / 48) * Math.PI * 2
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.strokeStyle = 'rgba(120, 80, 10, 0.55)'
    g.lineWidth = size * 0.012
    g.beginPath()
    g.arc(c, c, c * 0.78, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.arc(c, c, c * 0.6, 0, Math.PI * 2)
    g.stroke()
    // Ring text.
    g.fillStyle = 'rgba(95, 60, 5, 0.85)'
    g.font = `800 ${Math.round(size * 0.075)}px Inter, Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const label = '★ OFFICIAL SEAL ★ REGISTRAR ★ CERTICHAIN '
    for (let i = 0; i < label.length; i++) {
        const a = (i / label.length) * Math.PI * 2 - Math.PI / 2
        g.save()
        g.translate(c + Math.cos(a) * c * 0.69, c + Math.sin(a) * c * 0.69)
        g.rotate(a + Math.PI / 2)
        g.fillText(label[i], 0, 0)
        g.restore()
    }
    // Check mark.
    g.strokeStyle = 'rgba(95, 60, 5, 0.9)'
    g.lineWidth = size * 0.06
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(c - c * 0.28, c + c * 0.02)
    g.lineTo(c - c * 0.06, c + c * 0.24)
    g.lineTo(c + c * 0.32, c - c * 0.22)
    g.stroke()
}

// Holographic "Verified" badge.
function drawHolo(g, size, hue) {
    const c = size / 2
    const grad = g.createLinearGradient(0, 0, size, size)
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${(hue + i * 55) % 360}, 85%, 72%)`)
    g.clearRect(0, 0, size, size)
    g.fillStyle = grad
    g.beginPath()
    g.arc(c, c, c * 0.98, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = size * 0.03
    g.beginPath()
    g.arc(c, c, c * 0.82, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = 'rgba(15, 31, 56, 0.85)'
    g.font = `900 ${Math.round(size * 0.15)}px Inter, Arial, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('VERIFIED', c, c + size * 0.17)
    g.strokeStyle = 'rgba(15, 31, 56, 0.85)'
    g.lineWidth = size * 0.07
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(c - size * 0.15, c - size * 0.07)
    g.lineTo(c - size * 0.03, c + size * 0.04)
    g.lineTo(c + size * 0.17, c - size * 0.17)
    g.stroke()
}

// ---- Scene -------------------------------------------------------------------
export function createHeroCertificate(container, { reducedMotion = false } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.92
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.9

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    camera.position.set(0, 0, 7.4)

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d6ec, 0.7))
    const key = new THREE.DirectionalLight(0xfff4e2, 1.6)
    key.position.set(-3, 4, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.8)
    rim.position.set(4, -1, 3)
    scene.add(rim)

    const root = new THREE.Group()
    scene.add(root)
    const cert = new THREE.Group()
    root.add(cert)

    // Paper: a curved plane with the canvas face, plus a card-stock back.
    const faceCanvas = document.createElement('canvas')
    faceCanvas.width = TEX_W
    faceCanvas.height = TEX_H
    const faceCtx = faceCanvas.getContext('2d')
    const faceTex = new THREE.CanvasTexture(faceCanvas)
    faceTex.colorSpace = THREE.SRGBColorSpace
    faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const paperGeo = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 48, 32)
    const bend = (geo, depth) => {
        const p = geo.attributes.position
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) / (PAPER_W / 2)
            const y = p.getY(i) / (PAPER_H / 2)
            // A gentle bow plus a lifted bottom-right corner.
            const z = -0.09 * x * x + 0.05 * Math.max(0, x) * Math.max(0, -y) * Math.max(0, -y) + depth
            p.setZ(i, z)
        }
        geo.computeVertexNormals()
    }
    bend(paperGeo, 0)
    const paper = new THREE.Mesh(paperGeo, new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.82, metalness: 0 }))
    cert.add(paper)
    const backGeo = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 48, 32)
    bend(backGeo, -0.012)
    const back = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ color: 0xe9e1cc, roughness: 0.9, side: THREE.BackSide }))
    cert.add(back)

    // Light sweep across the paper.
    const sweepCanvas = document.createElement('canvas')
    sweepCanvas.width = 256
    sweepCanvas.height = 16
    const sg = sweepCanvas.getContext('2d')
    const sgrad = sg.createLinearGradient(0, 0, 256, 0)
    sgrad.addColorStop(0, 'rgba(255,255,255,0)')
    sgrad.addColorStop(0.45, 'rgba(255,255,255,0)')
    sgrad.addColorStop(0.5, 'rgba(255,255,255,0.55)')
    sgrad.addColorStop(0.55, 'rgba(255,255,255,0)')
    sgrad.addColorStop(1, 'rgba(255,255,255,0)')
    sg.fillStyle = sgrad
    sg.fillRect(0, 0, 256, 16)
    const sweepTex = new THREE.CanvasTexture(sweepCanvas)
    sweepTex.wrapS = THREE.RepeatWrapping
    sweepTex.repeat.set(0.5, 1)
    const sweepGeo = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 48, 32)
    bend(sweepGeo, 0.004)
    const sweepMat = new THREE.MeshBasicMaterial({ map: sweepTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6, toneMapped: false })
    cert.add(new THREE.Mesh(sweepGeo, sweepMat))

    // Gold seal with ribbons (bottom centre).
    const seal = new THREE.Group()
    seal.position.set(0, -0.78, 0.06)
    cert.add(seal)
    const ribbonMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide })
    for (const [x, rot, color] of [[-0.12, 0.35, 0xc8102e], [0.12, -0.35, 0x123b78]]) {
        const shape = new THREE.Shape()
        shape.moveTo(-0.07, 0)
        shape.lineTo(0.07, 0)
        shape.lineTo(0.07, -0.55)
        shape.lineTo(0, -0.46)
        shape.lineTo(-0.07, -0.55)
        shape.closePath()
        const ribbon = new THREE.Mesh(new THREE.ShapeGeometry(shape), ribbonMat(color))
        ribbon.position.set(x, -0.05, -0.03)
        ribbon.rotation.z = rot
        seal.add(ribbon)
    }
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a93a, metalness: 1, roughness: 0.28 })
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 64), goldMat)
    disc.rotation.x = Math.PI / 2
    seal.add(disc)
    const sealCanvas = document.createElement('canvas')
    sealCanvas.width = sealCanvas.height = 512
    drawSealFace(sealCanvas.getContext('2d'), 512)
    const sealTex = new THREE.CanvasTexture(sealCanvas)
    sealTex.colorSpace = THREE.SRGBColorSpace
    const sealFace = new THREE.Mesh(new THREE.CircleGeometry(0.31, 64), new THREE.MeshStandardMaterial({ map: sealTex, metalness: 0.75, roughness: 0.32, transparent: true }))
    sealFace.position.z = 0.031
    seal.add(sealFace)
    seal.scale.setScalar(0.001)

    // Holographic "Verified" badge (top right).
    const holoCanvas = document.createElement('canvas')
    holoCanvas.width = holoCanvas.height = 256
    const holoCtx = holoCanvas.getContext('2d')
    const holoTex = new THREE.CanvasTexture(holoCanvas)
    holoTex.colorSpace = THREE.SRGBColorSpace
    const holo = new THREE.Mesh(new THREE.CircleGeometry(0.3, 64), new THREE.MeshStandardMaterial({ map: holoTex, metalness: 0.6, roughness: 0.2, transparent: true }))
    holo.position.set(1.18, 0.74, 0.02)
    holo.scale.setScalar(0.001)
    cert.add(holo)

    // Soft shadow under the certificate.
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 128
    const shg = shadowCanvas.getContext('2d')
    const shgrad = shg.createRadialGradient(64, 64, 4, 64, 64, 64)
    shgrad.addColorStop(0, 'rgba(10,36,80,0.42)')
    shgrad.addColorStop(1, 'rgba(10,36,80,0)')
    shg.fillStyle = shgrad
    shg.fillRect(0, 0, 128, 128)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }))
    shadow.position.set(0, -1.36, -0.3)
    shadow.rotation.x = -Math.PI / 2.4
    root.add(shadow)

    // Gold sparkles for the seal stamp.
    const dot = document.createElement('canvas')
    dot.width = dot.height = 64
    const dg = dot.getContext('2d')
    const dgrad = dg.createRadialGradient(32, 32, 0, 32, 32, 32)
    dgrad.addColorStop(0, 'rgba(255,255,255,1)')
    dgrad.addColorStop(0.35, 'rgba(255,220,140,0.8)')
    dgrad.addColorStop(1, 'rgba(255,220,140,0)')
    dg.fillStyle = dgrad
    dg.fillRect(0, 0, 64, 64)
    const sparkCount = 90
    const sparkGeo = new THREE.BufferGeometry()
    const sparkPos = new Float32Array(sparkCount * 3)
    const sparkVel = new Float32Array(sparkCount * 3)
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
    const sparkMat = new THREE.PointsMaterial({ size: 0.09, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    cert.add(new THREE.Points(sparkGeo, sparkMat))
    let sparkAge = 9
    const sparkle = (x, y, color) => {
        sparkMat.color.set(color)
        for (let i = 0; i < sparkCount; i++) {
            sparkPos[i * 3] = x
            sparkPos[i * 3 + 1] = y
            sparkPos[i * 3 + 2] = 0.1
            const a = Math.random() * Math.PI * 2
            const s = 0.6 + Math.random() * 1.4
            sparkVel[i * 3] = Math.cos(a) * s
            sparkVel[i * 3 + 1] = Math.sin(a) * s
            sparkVel[i * 3 + 2] = 0.4 + Math.random() * 0.8
        }
        sparkGeo.attributes.position.needsUpdate = true
        sparkAge = 0
    }

    // ---- Face drawing (needs the fonts, school seal and QR) ------------------
    const assets = { logo: null, qr: null }
    let faceKey = ''
    let stage = 0
    const redrawFace = () => {
        const key = `${stage < 3}|${!!assets.logo}|${!!assets.qr}`
        if (key === faceKey) return
        faceKey = key
        drawCertificate(faceCtx, { seal: { logo: assets.logo }, qr: { canvas: assets.qr }, draft: stage < 3 })
        faceTex.needsUpdate = true
    }
    redrawFace()
    Promise.all([
        document.fonts?.load?.('700 40px Fraunces').catch(() => {}),
        document.fonts?.load?.('italic 700 40px Fraunces').catch(() => {}),
        loadImage(hcdcLogo),
        QRCode.toCanvas(document.createElement('canvas'), 'https://onlineregistrar.vercel.app/verify/CERT-000124', { margin: 0, width: 460, color: { dark: '#0f1f38', light: '#ffffff' } }).catch(() => null),
    ]).then(([, , logo, qr]) => {
        assets.logo = logo
        assets.qr = qr
        faceKey = ''
        redrawFace()
    })

    // ---- Interaction + animation -----------------------------------------------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = (e) => {
        const r = container.getBoundingClientRect()
        pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2
        pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    const onLeave = () => { pointer.tx = 0; pointer.ty = 0 }
    window.addEventListener('pointermove', onMove, { passive: true })
    container.addEventListener('pointerleave', onLeave)

    let stageTime = 0
    let elapsed = 0
    let active = true
    let frame = 0
    let holoHue = 0
    const clock = new THREE.Clock()

    const render = () => {
        frame = requestAnimationFrame(render)
        const dt = Math.min(0.1, clock.getDelta())
        if (!active) return
        elapsed += dt
        stageTime += dt
        const still = reducedMotion

        // Follow the pointer, with a slow idle sway.
        pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3)
        pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3)
        const sway = still ? 0 : 1
        cert.rotation.y = -0.32 + pointer.x * 0.28 + Math.sin(elapsed * 0.5) * 0.06 * sway
        cert.rotation.x = 0.1 + pointer.y * 0.18 + Math.sin(elapsed * 0.7) * 0.03 * sway
        cert.rotation.z = 0.035 + Math.sin(elapsed * 0.4) * 0.015 * sway
        cert.position.y = 0.1 + Math.sin(elapsed * 0.9) * 0.06 * sway
        shadow.scale.x = 1 - Math.sin(elapsed * 0.9) * 0.04 * sway

        // Light sweep every few seconds.
        const cycle = (elapsed % 5.5) / 5.5
        sweepTex.offset.x = still ? 0.5 : 1.1 - cycle * 2.2
        sweepMat.opacity = still ? 0 : 0.55

        // Seal: stamped when ready, stays after.
        const sealTarget = stage >= 3 ? 1 : 0
        if (sealTarget) {
            const k = stage === 3 ? popIn(stageTime / 0.7) : 1
            seal.scale.setScalar(Math.max(0.001, k))
            seal.position.z = 0.06 + (1 - easeOut(stageTime / 0.5)) * (stage === 3 ? 0.5 : 0)
        } else {
            seal.scale.setScalar(Math.max(0.001, seal.scale.x - dt * 3))
        }
        seal.rotation.z = Math.sin(elapsed * 0.8) * 0.04

        // Verified hologram on completion.
        if (stage >= 4) {
            holo.scale.setScalar(Math.max(0.001, popIn(stageTime / 0.8)))
            holoHue = (holoHue + dt * 60) % 360
            drawHolo(holoCtx, 256, holoHue + pointer.x * 80)
            holoTex.needsUpdate = true
        } else {
            holo.scale.setScalar(Math.max(0.001, holo.scale.x - dt * 3))
        }

        if (sparkAge < 1.6) {
            sparkAge += dt
            for (let i = 0; i < sparkCount; i++) {
                sparkPos[i * 3] += sparkVel[i * 3] * dt
                sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt
                sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt
                sparkVel[i * 3 + 1] -= 1.2 * dt
            }
            sparkGeo.attributes.position.needsUpdate = true
            sparkMat.opacity = Math.max(0, 1 - sparkAge / 1.3)
        }

        renderer.render(scene, camera)
    }

    const resize = () => {
        const w = container.clientWidth || 1
        const h = container.clientHeight || 1
        renderer.setSize(w, h, false)
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        camera.aspect = w / h
        // Keep the whole certificate in frame whatever the box shape.
        const fitH = (PAPER_H * 1.2) / 2
        const fitW = (PAPER_W * 1.1) / 2 / camera.aspect
        camera.fov = (2 * Math.atan(Math.max(fitH, fitW) / camera.position.z) * 180) / Math.PI
        camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    render()

    return {
        setStage(next) {
            if (next === stage) return
            const prev = stage
            stage = next
            stageTime = 0
            redrawFace()
            if (next === 3 && prev < 3) sparkle(0, -0.78, 0xffd27a)
            if (next === 4) sparkle(1.18, 0.74, 0xbfe3ff)
        },
        setActive(value) {
            active = value
            if (value) clock.getDelta()
        },
        dispose() {
            cancelAnimationFrame(frame)
            ro.disconnect()
            window.removeEventListener('pointermove', onMove)
            container.removeEventListener('pointerleave', onLeave)
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose()
                if (o.material) {
                    if (o.material.map) o.material.map.dispose()
                    o.material.dispose()
                }
            })
            env.dispose()
            pmrem.dispose()
            renderer.dispose()
            renderer.domElement.remove()
        },
    }
}
