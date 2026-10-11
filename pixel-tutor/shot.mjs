import { chromium } from '/home/manas/Documents/vortexa/whiteboard/node_modules/playwright-core/index.mjs'
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1400, height: 1130 } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
const poses = ['idle', 'point', 'up', 'wave', 'think', 'idea']
// one canvas strip: grab each pose's canvas via toDataURL and tile them
const tiles = []
for (const k of poses) {
	await p.goto('file:///home/manas/Documents/vortexa/pixel-tutor/pip.html?pose=' + encodeURIComponent(k) + '&talk=' + (k === 'idle' ? '' : '1'))
	await p.waitForTimeout(700)
	tiles.push(await p.evaluate(() => document.getElementById('cv').toDataURL()))
}
await p.setContent(`<body style="margin:0;background:#0d0f14;display:flex;flex-wrap:wrap;align-items:flex-start;gap:0">${tiles.map((t) => `<img src="${t}" style="width:200px;image-rendering:pixelated">`).join('')}</body>`)
await p.screenshot({ path: 'poses.png' })
await p.goto('file:///home/manas/Documents/vortexa/pixel-tutor/pip.html?pose=point&talk=1'); await p.waitForTimeout(500)
await p.screenshot({ path: 'page.png' })
console.log('errors:', errs); await b.close()
