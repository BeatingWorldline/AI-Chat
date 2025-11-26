import http from 'http'
import fs from 'fs'
import path from 'path'
import url from 'url'
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)))
const port = process.env.PORT || 5174
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}

function obfuscate(s){
  return Buffer.from(String(s),'utf8').toString('base64').split('').reverse().join('')
}

const server = http.createServer((req,res)=>{
  const u = new URL(req.url, `http://${req.headers.host}`)

  if (u.pathname === '/config') {
    const key = process.env.DASHSCOPE_API_KEY || ''
    const base = process.env.DASHSCOPE_BASE_URL || ''
    const payload = {
      key: key ? obfuscate(key) : '',
      base_url: base || '',
    }
    res.writeHead(200, {'Content-Type': 'application/json','Cache-Control':'no-store'})
    res.end(JSON.stringify(payload))
    return
  }

  let filePath = path.join(root, u.pathname)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return }
  const ext = path.extname(filePath)
  const type = types[ext] || 'application/octet-stream'
  res.writeHead(200, {'Content-Type': type})
  fs.createReadStream(filePath).pipe(res)
})
server.listen(port, ()=>{ console.log(`Preview: http://localhost:${port}/`) })