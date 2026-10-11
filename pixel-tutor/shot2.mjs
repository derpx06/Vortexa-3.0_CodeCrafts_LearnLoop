import { chromium } from '/home/manas/Documents/vortexa/whiteboard/node_modules/playwright-core/index.mjs'
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const p = await b.newPage({ viewport: { width: 1200, height: 1150 } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto('file:///home/manas/Documents/vortexa/Vortexa-3.0_CodeCrafts_LearnLoop/pixel-tutor/pip.html')
await p.click('#poses button[data-k="explain"]'); await p.click('#exprs button[data-k="excited"]')
await p.fill('#txt', 'Tokens are the small pieces a model reads.'); await p.uncheck('#voice'); await p.click('#speak'); await p.waitForTimeout(900)
await p.screenshot({ path: 'page.png' })
const frames = new Set(); for (let i = 0; i < 6; i++) { frames.add(await p.evaluate(() => document.getElementById('cv').toDataURL())); await p.waitForTimeout(120) }
console.log('distinct frames in 0.7s:', frames.size, '| api:', await p.evaluate(() => `${pip.actions.length} actions, ${pip.expressions.length} expressions`), '| errors:', errs); await b.close()
