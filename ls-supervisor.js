const fs=require('fs')
const path=require('path')
function find(dir){if(!fs.existsSync(dir))return[];const res=[];fs.readdirSync(dir).forEach(f=>{const full=path.join(dir,f);fs.statSync(full).isDirectory()?res.push(...find(full)):res.push(full)});return res}
find('app/supervisor').forEach(f=>process.stdout.write(f+'\n'))
