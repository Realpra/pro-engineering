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
const files=find('app/supervisor')
console.log('ALL SUPERVISOR FILES:')
files.forEach(f=>console.log(f+' ('+fs.statSync(f).size+' bytes)'))
