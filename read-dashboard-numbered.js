const fs=require('fs')
const c=fs.readFileSync('app/supervisor/dashboard/page.tsx','utf8')
c.split('\n').forEach((l,i)=>process.stdout.write((i+1)+': '+l+'\n'))
