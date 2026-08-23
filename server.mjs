import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const port = Number(process.env.API_PORT || 8787)
const dataDir = new URL('./data/', import.meta.url)
const dbUrl = new URL('./data/auth.json', import.meta.url)
const sessionHours = 24 * 7

async function readDb() {
  if (!existsSync(dbUrl)) return { users: [], sessions: [], resetTokens: [] }
  return JSON.parse(await readFile(dbUrl, 'utf8'))
}
async function writeDb(db) {
  await mkdir(dataDir, { recursive: true })
  await writeFile(dbUrl, JSON.stringify(db, null, 2))
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `${salt}:${derived.toString('hex')}`
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const derived = await scrypt(password, salt, 64)
  return timingSafeEqual(Buffer.from(hash, 'hex'), derived)
}
function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(';').map((item) => item.trim()) || []
  return cookies.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1)
}
function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers })
  response.end(JSON.stringify(body))
}
function safeUser(user) {
  return { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar, createdAt: user.createdAt }
}
async function body(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  try { return JSON.parse(raw || '{}') } catch { return null }
}
async function currentUser(request, db) {
  const token = cookieValue(request, 'gg_session')
  const session = db.sessions.find((item) => item.token === token && item.expiresAt > Date.now())
  return session ? db.users.find((user) => user.id === session.userId) : null
}
async function ensureMiddleman(db) {
  const email = process.env.MIDDLEMAN_EMAIL?.trim().toLowerCase()
  const password = process.env.MIDDLEMAN_PASSWORD
  if (!email || !password || db.users.some((user) => user.email === email)) return
  const username = process.env.MIDDLEMAN_USERNAME?.trim() || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
  db.users.push({ id: randomBytes(12).toString('hex'), username, email, passwordHash: await hashPassword(password), role: 'middleman', avatar: username.slice(0, 2).toUpperCase(), createdAt: new Date().toISOString() })
}
async function requireMiddleman(request, db) {
  const user = await currentUser(request, db)
  return user && (user.role === 'middleman' || user.role === 'admin') ? user : null
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
function validPassword(password) { return typeof password === 'string' && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) }
function sessionCookie(token, maxAge = sessionHours * 60 * 60) { return `gg_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` }

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }
  if (!request.url?.startsWith('/api/')) return send(response, 404, { error: 'Not found' })
  const db = await readDb()
  db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now())
  const path = new URL(request.url, `http://${request.headers.host}`).pathname
  const method = request.method
  try {
    await ensureMiddleman(db)
    if (process.env.MIDDLEMAN_EMAIL && db.users.some((user) => user.role === 'middleman')) await writeDb(db)
    if (method === 'GET' && path === '/api/auth/me') {
      const user = await currentUser(request, db)
      return send(response, 200, { user: user ? safeUser(user) : null })
    }
    if (method === 'POST' && path === '/api/auth/signup') {
      const input = await body(request)
      if (!input || !input.username || !input.email || !input.password || !input.confirmPassword) return send(response, 400, { error: 'All fields are required.' })
      if (input.username.length < 3 || input.username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(input.username)) return send(response, 400, { error: 'Username must be 3-24 characters using letters, numbers, or underscores.' })
      if (!validEmail(input.email)) return send(response, 400, { error: 'Enter a valid email address.' })
      if (!validPassword(input.password)) return send(response, 400, { error: 'Password must be 8+ characters with upper, lower, and numeric characters.' })
      if (input.password !== input.confirmPassword) return send(response, 400, { error: "Passwords don't match." })
      if (db.users.some((user) => user.username.toLowerCase() === input.username.toLowerCase())) return send(response, 409, { error: 'Username already exists.' })
      if (db.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) return send(response, 409, { error: 'Email already registered.' })
      const user = { id: randomBytes(12).toString('hex'), username: input.username, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password), role: 'customer', avatar: input.username.slice(0, 2).toUpperCase(), createdAt: new Date().toISOString() }
      const token = randomBytes(32).toString('hex')
      db.users.push(user); db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); await writeDb(db)
      return send(response, 201, { user: safeUser(user) }, { 'set-cookie': sessionCookie(token) })
    }
    if (method === 'POST' && path === '/api/auth/login') {
      const input = await body(request)
      const identity = String(input?.identity || '').trim().toLowerCase()
      const user = db.users.find((item) => item.email.toLowerCase() === identity || item.username.toLowerCase() === identity)
      if (!user || !input?.password || !(await verifyPassword(input.password, user.passwordHash))) return send(response, 401, { error: 'Invalid username/email or password.' })
      const token = randomBytes(32).toString('hex')
      db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); await writeDb(db)
      return send(response, 200, { user: safeUser(user) }, { 'set-cookie': sessionCookie(token) })
    }
    if (method === 'POST' && path === '/api/middleman/login') {
      const input = await body(request)
      const identity = String(input?.identity || input?.email || '').trim().toLowerCase()
      const user = db.users.find((item) => (item.email.toLowerCase() === identity || item.username.toLowerCase() === identity) && (item.role === 'middleman' || item.role === 'admin'))
      if (!user || !input?.password || !(await verifyPassword(input.password, user.passwordHash))) return send(response, 401, { error: 'Invalid middleman credentials.' })
      const token = randomBytes(32).toString('hex')
      db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); await writeDb(db)
      return send(response, 200, { user: safeUser(user) }, { 'set-cookie': sessionCookie(token) })
    }
    if (method === 'GET' && path === '/api/middleman/me') {
      const user = await requireMiddleman(request, db)
      return user ? send(response, 200, { user: safeUser(user), stats: { pendingRequests: 0, activeTransactions: 0, completedTransactions: 0, openDisputes: 0 } }) : send(response, 403, { error: 'Middleman access required.' })
    }
    if (method === 'POST' && path === '/api/auth/logout') {
      const token = cookieValue(request, 'gg_session'); db.sessions = db.sessions.filter((session) => session.token !== token); await writeDb(db)
      return send(response, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0) })
    }
    if (method === 'POST' && path === '/api/auth/forgot-password') {
      const input = await body(request); const user = db.users.find((item) => item.email.toLowerCase() === String(input?.email || '').toLowerCase())
      if (user) { db.resetTokens.push({ token: randomBytes(24).toString('hex'), userId: user.id, expiresAt: Date.now() + 15 * 60 * 1000 }); await writeDb(db) }
      return send(response, 200, { message: "If an account exists for this email, you'll receive instructions to reset your password." })
    }
    return send(response, 404, { error: 'Not found' })
  } catch (error) { console.error(error); return send(response, 500, { error: 'Something went wrong. Please try again.' }) }
})
server.listen(port, () => console.log(`GameGuard API listening on http://localhost:${port}`))
