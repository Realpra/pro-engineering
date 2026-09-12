const fs=require('fs')
const c=fs.readFileSync('app/supervisor/site-visit/SiteVisitManager.tsx','utf8')
const screens=c.match(/Screen\d+_\w+/g)||[]
const unique=[...new Set(screens)]
console.log('SCREENS REFERENCED IN SiteVisitManager.tsx:')
unique.forEach(s=>console.log(s))
const dir=fs.readdirSync('app/supervisor/site-visit').filter(f=>f.match(/Screen\d+/))
console.log('\nSCREEN FILES ON DISK:')
dir.forEach(f=>console.log(f))
console.log('\nFILES ON DISK NOT REFERENCED IN SiteVisitManager:')
dir.filter(f=>!unique.some(u=>f.includes(u))).forEach(f=>console.log('ORPHAN: '+f))
console.log('\nREFERENCED BUT NOT ON DISK:')
unique.filter(u=>!dir.some(f=>f.includes(u))).forEach(u=>console.log('MISSING: '+u))
