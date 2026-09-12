PROTOCOL - ALL DEVELOPMENT

FLOW:
Claude writes executable script -> User pastes to Claude Code -> Claude Code runs -> User pastes raw output to Claude -> Claude reads and writes next script

CLAUDE CODE RULES:
1. Run scripts as given. Paste complete raw output.
2. Before running: check if script premise matches reality (file exists, columns exist, patterns match).
3. If ONE gap or mismatch found: state GAP - [plain language description of what is actually there vs what script assumes] then run remaining steps.
4. If TWO OR MORE gaps or mismatches found: state all gaps as GAP1, GAP2 etc. DO NOT RUN. Wait for Claude to fix script.
5. If script step is destructive (DROP, DELETE, truncate): state DESTRUCTIVE - [what will be deleted] and wait 1 line for user to confirm before running that step only.
6. No decisions. No guessing. No added steps. No removed steps.
7. No asking user anything. Report gaps in output only.

CLAUDE RULES:
1. Verify complete DB state and file state before writing any script.
2. Scripts must contain READ + CHECK + FIX + VERIFY + TSC in one pass.
3. Never assume file exists - script checks fs.existsSync first.
4. Never assume DB table or column exists - script verifies first.
5. When Claude Code reports GAP: fix the script and resend.
6. When Claude Code reports multiple GAPs: fix all before resending.
7. Never use regex backreferences $1 $2 $& in PowerShell double-quoted strings.
8. Always use a .js file instead of node -e for any script containing regex replacements.
9. Never include PROTOCOL.md or CLAUDE_PROTOCOL.md in any cleanup/delete script.

USER RULES:
1. Paste Claude scripts to Claude Code exactly as given.
2. Paste complete raw Claude Code output back to Claude exactly as given.