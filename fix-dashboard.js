const fs = require('fs');
const lines = fs.readFileSync('app/site-incharge/dashboard/page.tsx', 'utf8').split('\n');
// Find the line with </a> after the progress bar closing div
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('                      </a>') && 
      lines[i-1] && lines[i-1].includes('                        </div>')) {
    // Insert progress text before </a> and fix closing tags
    lines.splice(i, 4,
      '                        <p className="text-xs text-gray-400 mt-1">{sub.completion_pct ?? 0}% complete</p>',
      '                      </a>',
      '                    ))}',
      '                  </div>',
      '                </div>',
      '              )',
      '            })}'
    );
    break;
  }
}
fs.writeFileSync('app/site-incharge/dashboard/page.tsx', lines.join('\n'));
console.log('DONE');