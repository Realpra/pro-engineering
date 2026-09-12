const fs=require('fs')
const {execSync}=require('child_process')

// Verify prerequisites before building
const checks={
  'app/supervisor/dashboard/page.tsx': fs.existsSync('app/supervisor/dashboard/page.tsx'),
  'app/supervisor/login/page.tsx': fs.existsSync('app/supervisor/login/page.tsx'),
  'app/admin/dashboard/page.tsx': fs.existsSync('app/admin/dashboard/page.tsx'),
}
console.log('=== PREREQUISITE CHECK ===')
Object.entries(checks).forEach(([f,e])=>console.log((e?'EXISTS':'MISSING')+': '+f))

const allExist=Object.values(checks).every(Boolean)
if(!allExist){console.log('BLOCKED: missing prerequisite files');process.exit(1)}

// Read supervisor dashboard to understand current structure
const dash=fs.readFileSync('app/supervisor/dashboard/page.tsx','utf8')
console.log('\n=== SUPERVISOR DASHBOARD LINES 1-50 ===')
dash.split('\n').slice(0,50).forEach((l,i)=>process.stdout.write((i+1)+': '+l+'\n'))

// Read admin dashboard to understand where to add milestone approval
const adminDash=fs.readFileSync('app/admin/dashboard/page.tsx','utf8')
console.log('\n=== ADMIN DASHBOARD TABS (lines containing tab) ===')
adminDash.split('\n').forEach((l,i)=>{if(l.toLowerCase().includes('tab'))process.stdout.write((i+1)+': '+l+'\n')})

console.log('\n=== READY TO BUILD ===')
console.log('Next: create supervisor milestone evidence submission and coordinator approval panel')
