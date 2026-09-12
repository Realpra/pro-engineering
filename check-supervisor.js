const fs=require('fs')
const path=require('path')
function find(dir){
  if(!fs.existsSync(dir))return[]
  const res=[]
  fs.readdirSync(dir).forEach(f=>{
    const full=path.join(dir,f)
    fs.statSync(full).isDirectory()?res.push(...find(full)):res.push(full)
  })
  return res
}
console.log('=== SUPERVISOR PAGES ===')
const sup=find('app/supervisor')
sup.length?sup.forEach(f=>console.log(f)):console.log('NONE - needs to be created')
console.log('\n=== SUPERVISOR LOGIN ===')
console.log(fs.existsSync('app/supervisor/login')?'EXISTS':'MISSING')
