const fs=require('fs')
process.stdout.write(fs.readFileSync('app/supervisor/dashboard/page.tsx','utf8'))
