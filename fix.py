import pathlib
p = pathlib.Path('public/wallet.js')
text = p.read_text('utf-8')
text = text.replace("`/api/points/${walletUserId}/ledger?limit=15`", "`/api/points/${walletUserId}/ledger?limit=15&_t=${Date.now()}`")
text = text.replace("`/api/token?userId=${walletUserId || ''}`", "`/api/token?userId=${walletUserId || ''}&_t=${Date.now()}`")
text = text.replace('"/api/esg"', "`/api/esg?_t=${Date.now()}`")
p.write_text(text, 'utf-8')
