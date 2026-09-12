const fs=require('fs'); 
let p=fs.readFileSync('app/admin/dashboard/page.tsx','utf8'); 
if(p.includes('const rg=')){console.log('ALREADY FIXED');process.exit()} 
const idx=p.indexOf('export default async function'); 
const funcStart=p.indexOf('{',idx); 
const supabaseIdx=p.indexOf('const supabase = await createClient()',funcStart); 
const after=supabaseIdx+38; 
const guard="\n  const {data:{user:ug}}=await supabase.auth.getUser()\n  if(!ug)redirect('/login')\n  const {data:pg}=await supabase.from('users').select('platform_role').eq('id',ug.id).single()\n  const rg=pg?.platform_role\n  if(rg==='supervisor'||rg==='client'||!rg)redirect('/login')\n"; 
p=p.slice(0,after)+guard+p.slice(after); 
fs.writeFileSync('app/admin/dashboard/page.tsx',p); 
