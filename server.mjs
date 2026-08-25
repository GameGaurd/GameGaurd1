import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { extname } from 'node:path'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const port = Number(process.env.API_PORT || process.env.PORT || 8787)
const dataDir = process.env.VERCEL === '1' ? new URL('file:///tmp/gameguard-data/') : new URL('./data/', import.meta.url)
const dbUrl = new URL('auth.json', dataDir)
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const sessionHours = 24 * 7
const sessionSecret = process.env.SESSION_SECRET || process.env.MIDDLEMAN_PASSWORD || 'gameguard-development-session-secret'

function emptyDb() { return { users: [], sessions: [], resetTokens: [], requests: [], messages: [], conversations: [], auditLogs: [] } }
function supabaseHeaders() { return { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'content-type': 'application/json' } }
async function readDb() {
  if (supabaseUrl && supabaseKey) {
    const response = await fetch(`${supabaseUrl}/rest/v1/gameguard_state?id=eq.main&select=data`, { headers: supabaseHeaders() })
    if (!response.ok) throw new Error(`Supabase read failed (${response.status})`)
    const rows = await response.json()
    return { ...emptyDb(), ...(rows[0]?.data || {}) }
  }
  if (!existsSync(dbUrl)) return emptyDb()
  return { requests: [], messages: [], conversations: [], auditLogs: [], ...JSON.parse(await readFile(dbUrl, 'utf8')) }
}
async function writeDb(db) {
  if (supabaseUrl && supabaseKey) {
    const response = await fetch(`${supabaseUrl}/rest/v1/gameguard_state`, { method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'main', data: db, updated_at: new Date().toISOString() }) })
    if (!response.ok) throw new Error(`Supabase write failed (${response.status})`)
    return
  }
  await mkdir(dataDir, { recursive: true })
  const tempUrl = new URL(`auth.json.${process.pid}.${randomBytes(8).toString('hex')}.tmp`, dataDir)
  await writeFile(tempUrl, JSON.stringify(db, null, 2))
  await rename(tempUrl, dbUrl)
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
function signedSession(user) {
  const payload = Buffer.from(JSON.stringify({ userId: user.id, username: user.username, displayName: user.displayName, email: user.email, role: user.role, avatar: user.avatar, avatarUrl: user.avatarUrl, verifiedMiddleman: user.verifiedMiddleman, createdAt: user.createdAt, expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 })).toString('base64url')
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}
function verifySignedSession(token, db) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (session.expiresAt <= Date.now() || !['customer', 'middleman', 'admin'].includes(session.role)) return null
    return db.users.find((user) => user.email === session.email && user.role === session.role)
      || db.users.find((user) => user.id === session.userId && user.role === session.role)
      || { id: session.userId, username: session.username, displayName: session.displayName, email: session.email, role: session.role, avatar: session.avatar, avatarUrl: session.avatarUrl, verifiedMiddleman: session.verifiedMiddleman, createdAt: session.createdAt }
  } catch { return null }
}
function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers })
  response.end(JSON.stringify(body))
}
function safeUser(user) {
  return { id: user.id, username: user.username, displayName: user.displayName || user.username, email: user.email, role: user.role, avatar: user.avatar, avatarUrl: user.avatarUrl, verifiedMiddleman: Boolean(user.verifiedMiddleman), createdAt: user.createdAt }
}
async function body(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  try { return JSON.parse(raw || '{}') } catch { return null }
}
async function currentUser(request, db) {
  const token = cookieValue(request, 'gg_session')
  const session = db.sessions.find((item) => item.token === token && item.expiresAt > Date.now())
  return session ? db.users.find((user) => user.id === session.userId) : verifySignedSession(token, db)
}
async function ensureMiddleman(db) {
  const email = process.env.MIDDLEMAN_EMAIL?.trim().toLowerCase()
  const password = process.env.MIDDLEMAN_PASSWORD
  if (!email || !password) return
  const existing = db.users.find((user) => user.email === email && user.role === 'middleman')
    || db.users.find((user) => user.role === 'middleman' && user.username === 'MysticMM')
    || db.users.find((user) => user.role === 'middleman')
  if (existing) {
    existing.email = email
    existing.passwordHash = await hashPassword(password)
    existing.username = 'MysticMM'; existing.displayName = 'MysticMM'; existing.avatar = 'MM'; existing.avatarUrl = '/avatars/mysticmm.svg'; existing.verifiedMiddleman = true
    return
  }
  const username = process.env.MIDDLEMAN_USERNAME?.trim() || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
  db.users.push({ id: randomBytes(12).toString('hex'), username: 'MysticMM', displayName: 'MysticMM', email, passwordHash: await hashPassword(password), role: 'middleman', avatar: 'MM', avatarUrl: '/avatars/mysticmm.svg', verifiedMiddleman: true, createdAt: new Date().toISOString() })
}
async function requireMiddleman(request, db) {
  const user = await currentUser(request, db)
  return user && (user.role === 'middleman' || user.role === 'admin') ? user : null
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
function validPassword(password) { return typeof password === 'string' && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) }
function sessionCookie(token, maxAge = sessionHours * 60 * 60) { return `gg_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` }
function requestView(item, db) {
  const buyer = db.users.find((user) => user.id === item.buyerId)
  const seller = db.users.find((user) => user.id === item.sellerId)
  const middleman = db.users.find((user) => user.id === item.middlemanId)
  const allowedAuthors = new Set([item.middlemanId, item.buyerId, item.sellerId].filter(Boolean))
  return { ...item, middleman: middleman ? safeUser(middleman) : null, buyer: buyer ? safeUser(buyer) : null, seller: seller ? safeUser(seller) : null, messages: db.messages.filter((message) => message.requestId === item.id && allowedAuthors.has(message.authorId)).map((message) => { const author = db.users.find((user) => user.id === message.authorId); return { ...message, authorName: author?.username || (message.system ? 'System' : 'Participant'), authorRole: author?.role || (message.system ? 'SYSTEM' : 'PARTICIPANT') } }) }
}
function privateConversationView(conversation, db) {
  const participantIds = [conversation.customerId, conversation.middlemanId]
  const customer = db.users.find((user) => user.id === conversation.customerId)
  const middleman = db.users.find((user) => user.id === conversation.middlemanId)
  return { ...conversation, customer: customer ? safeUser(customer) : null, middleman: middleman ? safeUser(middleman) : null, messages: db.messages.filter((message) => message.conversationId === conversation.id && participantIds.includes(message.authorId)).map((message) => { const author = db.users.find((user) => user.id === message.authorId); return { ...message, authorName: author?.username || 'Participant', authorRole: author?.role || 'customer' } }) }
}
function canViewConversation(conversation, user) { return Boolean(user && conversation && (conversation.customerId === user.id || conversation.middlemanId === user.id)) }
function markMessagesRead(db, requestIds, userId) {
  let changed = false
  for (const message of db.messages) {
    if ((requestIds.has(message.requestId) || requestIds.has(message.conversationId)) && message.authorId !== userId && !message.readBy?.includes(userId)) {
      message.readBy = [...(message.readBy || []), userId]
      changed = true
    }
  }
  return changed
}
function addAudit(db, requestId, userId, action, detail) { db.auditLogs.push({ id: randomBytes(10).toString('hex'), requestId, userId, action, detail, createdAt: new Date().toISOString() }) }
const contentTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
async function serveFrontend(request, response) {
  if (request.method !== 'GET') return false
  const requestedPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  if (requestedPath.startsWith('/api/')) return false
  const relativePath = requestedPath === '/' ? '/index.html' : requestedPath
  if (relativePath.includes('..')) return false
  const fileUrl = new URL(`./dist${relativePath}`, import.meta.url)
  try {
    const file = await readFile(fileUrl)
    response.writeHead(200, { 'content-type': contentTypes[extname(relativePath)] || 'application/octet-stream' })
    response.end(file)
    return true
  } catch {
    if (!extname(relativePath)) {
      const file = await readFile(new URL('./dist/index.html', import.meta.url))
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(file)
      return true
    }
    return false
  }
}

export const handler = async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }
  if (await serveFrontend(request, response)) return
  if (!request.url?.startsWith('/api/')) return send(response, 404, { error: 'Not found' })
  const db = await readDb()
  db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now())
  const requestUrl = new URL(request.url, `http://${request.headers.host}`)
  const path = requestUrl.pathname === '/api/index' && requestUrl.searchParams.has('path')
    ? `/api/${requestUrl.searchParams.get('path')}`
    : requestUrl.pathname
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
      const token = signedSession(user)
      db.users.push(user); db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); await writeDb(db)
      return send(response, 201, { user: safeUser(user) }, { 'set-cookie': sessionCookie(token) })
    }
    if (method === 'POST' && path === '/api/auth/login') {
      const input = await body(request)
      const identity = String(input?.identity || '').trim().toLowerCase()
      const user = db.users.find((item) => item.email.toLowerCase() === identity || item.username.toLowerCase() === identity)
      if (!user || !input?.password || !(await verifyPassword(input.password, user.passwordHash))) return send(response, 401, { error: 'Invalid username/email or password.' })
      const token = signedSession(user)
      db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); await writeDb(db)
      return send(response, 200, { user: safeUser(user) }, { 'set-cookie': sessionCookie(token) })
    }
    if (method === 'POST' && path === '/api/middleman/login') {
      const input = await body(request)
      const identity = String(input?.identity || input?.email || '').trim().toLowerCase()
      const user = db.users.find((item) => (item.email.toLowerCase() === identity || item.username.toLowerCase() === identity) && (item.role === 'middleman' || item.role === 'admin'))
      if (!user || !input?.password || !(await verifyPassword(input.password, user.passwordHash))) return send(response, 401, { error: 'Invalid middleman credentials.' })
      const token = signedSession(user)
      db.sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + sessionHours * 60 * 60 * 1000 }); await writeDb(db)
      return send(response, 200, { user: safeUser(user) }, { 'set-cookie': sessionCookie(token) })
    }
    if (method === 'GET' && path === '/api/middleman/me') {
      const user = await requireMiddleman(request, db)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      const assigned = db.requests.filter((item) => item.middlemanId === user.id)
      return send(response, 200, { user: safeUser(user), stats: { pendingRequests: assigned.filter((item) => item.status === 'Open').length, activeTransactions: assigned.filter((item) => ['Accepted', 'Verification', 'In Progress'].includes(item.status)).length, completedTransactions: assigned.filter((item) => item.status === 'Completed').length, openDisputes: assigned.filter((item) => item.status === 'Disputed').length }, completedCount: assigned.filter((item) => item.status === 'Completed').length, averageRating: 'Not rated yet' })
    }
    if (method === 'GET' && path === '/api/middleman/conversations') {
      const user = await requireMiddleman(request, db)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      return send(response, 200, { conversations: db.conversations.filter((conversation) => conversation.middlemanId === user.id).map((conversation) => privateConversationView(conversation, db)) })
    }
    if (method === 'GET' && path === '/api/conversations') {
      const user = await currentUser(request, db)
      if (!user) return send(response, 401, { error: 'Authentication required.' })
      const conversations = db.conversations
        .filter((conversation) => conversation.customerId === user.id || conversation.middlemanId === user.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((conversation) => privateConversationView(conversation, db))
      return send(response, 200, { conversations })
    }
    if (method === 'POST' && path === '/api/conversations') {
      const user = await currentUser(request, db)
      const input = await body(request)
      if (!user) return send(response, 401, { error: 'Authentication required.' })
      const middleman = db.users.find((item) => item.id === input?.middlemanId && ['middleman', 'admin'].includes(item.role)) || db.users.find((item) => item.role === 'middleman')
      if (!middleman) return send(response, 503, { error: 'No middleman is available.' })
      const customerId = user.role === 'customer' ? user.id : input?.customerId
      const existing = db.conversations.find((conversation) => conversation.customerId === customerId && conversation.middlemanId === middleman.id)
      if (existing) return send(response, 200, { conversation: privateConversationView(existing, db) })
      const conversation = { id: `DM-${randomBytes(8).toString('hex')}`, customerId, middlemanId: middleman.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      db.conversations.push(conversation); await writeDb(db)
      return send(response, 201, { conversation: privateConversationView(conversation, db) })
    }
    const conversationMatch = path.match(/^\/api\/conversations\/([^/]+)$/)
    if (conversationMatch && method === 'GET') {
      const user = await currentUser(request, db)
      const conversation = db.conversations.find((item) => item.id === conversationMatch[1])
      if (!canViewConversation(conversation, user)) return send(response, 403, { error: 'Private conversation access required.' })
      if (markMessagesRead(db, new Set([conversation.id]), user.id)) await writeDb(db)
      return send(response, 200, { conversation: privateConversationView(conversation, db) })
    }
    const conversationMessageMatch = path.match(/^\/api\/conversations\/([^/]+)\/messages$/)
    if (conversationMessageMatch && method === 'POST') {
      const user = await currentUser(request, db)
      const conversation = db.conversations.find((item) => item.id === conversationMessageMatch[1])
      const input = await body(request)
      if (!canViewConversation(conversation, user)) return send(response, 403, { error: 'Private conversation access required.' })
      if (!String(input?.body || '').trim()) return send(response, 400, { error: 'Message cannot be empty.' })
      const message = { id: randomBytes(10).toString('hex'), conversationId: conversation.id, authorId: user.id, body: String(input.body).trim(), attachment: input?.attachment || null, system: false, createdAt: new Date().toISOString(), readBy: [user.id] }
      db.messages.push(message); conversation.updatedAt = message.createdAt; await writeDb(db)
      return send(response, 201, { message })
    }
    if (method === 'GET' && path === '/api/middleman/requests') {
      const user = await requireMiddleman(request, db)
      const assigned = db.requests.filter((item) => item.middlemanId === user?.id)
      if (user && markMessagesRead(db, new Set(assigned.map((item) => item.id)), user.id)) await writeDb(db)
      return user ? send(response, 200, { requests: assigned.map((item) => requestView(item, db)) }) : send(response, 403, { error: 'Middleman access required.' })
    }
    const requestMatch = path.match(/^\/api\/middleman\/requests\/([^/]+)$/)
    if (requestMatch && method === 'GET') {
      const user = await requireMiddleman(request, db)
      const item = db.requests.find((entry) => entry.id === requestMatch[1] && entry.middlemanId === user?.id)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      return item ? send(response, 200, { request: requestView(item, db) }) : send(response, 404, { error: 'Request not found.' })
    }
    if (requestMatch && method === 'PATCH') {
      const user = await requireMiddleman(request, db)
      const item = db.requests.find((entry) => entry.id === requestMatch[1] && entry.middlemanId === user?.id)
      const input = await body(request)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      if (!item) return send(response, 404, { error: 'Request not found.' })
      if (!['Open', 'Accepted', 'Declined', 'Verification', 'In Progress', 'Completed', 'Disputed'].includes(input?.status)) return send(response, 400, { error: 'Invalid request status.' })
      item.status = input.status; item.updatedAt = new Date().toISOString(); addAudit(db, item.id, user.id, 'status_changed', `Status changed to ${item.status}`)
      db.messages.push({ id: randomBytes(10).toString('hex'), requestId: item.id, authorId: user.id, body: `System: transaction status changed to ${item.status}.`, system: true, createdAt: new Date().toISOString(), readBy: [user.id] })
      await writeDb(db); return send(response, 200, { request: requestView(item, db) })
    }
    const participantMatch = path.match(/^\/api\/middleman\/requests\/([^/]+)\/participants$/)
    if (participantMatch && method === 'POST') {
      const user = await requireMiddleman(request, db)
      const item = db.requests.find((entry) => entry.id === participantMatch[1] && entry.middlemanId === user?.id)
      const input = await body(request)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      if (!item) return send(response, 404, { error: 'Request not found.' })
      if (input?.role !== 'buyer' || !String(input?.username || '').trim()) return send(response, 400, { error: 'Enter the buyer username.' })
      const participant = db.users.find((entry) => entry.username.toLowerCase() === String(input.username).trim().toLowerCase())
      if (!participant) return send(response, 404, { error: 'No account found with that username.' })
      item[`${input.role}Id`] = participant.id; item.updatedAt = new Date().toISOString(); addAudit(db, item.id, user.id, 'participant_added', `${input.role} added: ${participant.username}`); await writeDb(db)
      return send(response, 200, { request: requestView(item, db) })
    }
    const participantRemoveMatch = path.match(/^\/api\/middleman\/requests\/([^/]+)\/participants\/([^/]+)$/)
    if (participantRemoveMatch && method === 'DELETE') {
      const user = await requireMiddleman(request, db)
      const item = db.requests.find((entry) => entry.id === participantRemoveMatch[1] && entry.middlemanId === user?.id)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      if (!item) return send(response, 404, { error: 'Request not found.' })
      if (![item.buyerId, item.sellerId].includes(participantRemoveMatch[2])) return send(response, 404, { error: 'Participant is not assigned.' })
      if (item.buyerId === participantRemoveMatch[2]) item.buyerId = null
      if (item.sellerId === participantRemoveMatch[2]) item.sellerId = null
      item.updatedAt = new Date().toISOString(); addAudit(db, item.id, user.id, 'participant_removed', 'Participant removed from request'); await writeDb(db)
      return send(response, 200, { request: requestView(item, db) })
    }
    const messageMatch = path.match(/^\/api\/middleman\/requests\/([^/]+)\/messages$/)
    if (messageMatch && method === 'POST') {
      const user = await requireMiddleman(request, db)
      const item = db.requests.find((entry) => entry.id === messageMatch[1] && entry.middlemanId === user?.id)
      const input = await body(request)
      if (!user) return send(response, 403, { error: 'Middleman access required.' })
      if (!item) return send(response, 404, { error: 'Request not found.' })
      if (!String(input?.body || '').trim()) return send(response, 400, { error: 'Message cannot be empty.' })
      const message = { id: randomBytes(10).toString('hex'), requestId: item.id, authorId: user.id, body: String(input.body).trim(), attachment: input?.attachment || null, system: false, createdAt: new Date().toISOString(), readBy: [user.id] }
      db.messages.push(message); addAudit(db, item.id, user.id, 'message_sent', 'Middleman sent a chat message'); await writeDb(db)
      return send(response, 201, { message })
    }
    if (method === 'GET' && path === '/api/middleman/audit-logs') {
      const user = await requireMiddleman(request, db)
      const ids = new Set(db.requests.filter((item) => item.middlemanId === user?.id).map((item) => item.id))
      return user ? send(response, 200, { logs: db.auditLogs.filter((log) => ids.has(log.requestId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }) : send(response, 403, { error: 'Middleman access required.' })
    }
    if (method === 'GET' && path === '/api/requests') {
      const user = await currentUser(request, db)
      if (!user) return send(response, 401, { error: 'Authentication required.' })
      const accessible = db.requests.filter((item) => item.requesterId === user.id || item.buyerId === user.id || item.sellerId === user.id)
      if (markMessagesRead(db, new Set(accessible.map((item) => item.id)), user.id)) await writeDb(db)
      return send(response, 200, { requests: accessible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => requestView(item, db)) })
    }
    const customerMessageMatch = path.match(/^\/api\/requests\/([^/]+)\/messages$/)
    if (customerMessageMatch && method === 'POST') {
      const user = await currentUser(request, db)
      const item = db.requests.find((entry) => entry.id === customerMessageMatch[1] && (entry.requesterId === user?.id || entry.buyerId === user?.id || entry.sellerId === user?.id))
      const input = await body(request)
      if (!user) return send(response, 401, { error: 'Authentication required.' })
      if (!item) return send(response, 404, { error: 'Transaction not found.' })
      if (!String(input?.body || '').trim()) return send(response, 400, { error: 'Message cannot be empty.' })
      const message = { id: randomBytes(10).toString('hex'), requestId: item.id, authorId: user.id, body: String(input.body).trim(), attachment: input?.attachment || null, system: false, createdAt: new Date().toISOString(), readBy: [user.id] }
      db.messages.push(message); addAudit(db, item.id, user.id, 'message_sent', 'Participant sent a chat message'); await writeDb(db)
      return send(response, 201, { message })
    }
    if (method === 'POST' && path === '/api/requests') {
      const user = await currentUser(request, db)
      const input = await body(request)
      const middleman = db.users.find((item) => item.role === 'middleman')
      if (!user) return send(response, 401, { error: 'Authentication required.' })
      if (!middleman) return send(response, 503, { error: 'No middleman is available.' })
      const item = { id: `MM-${new Date().getFullYear()}-${String(db.requests.length + 1).padStart(6, '0')}`, game: String(input?.game || 'Unspecified'), item: String(input?.item || 'Transaction'), amount: String(input?.amount || '0.00'), status: 'Open', createdAt: new Date().toISOString(), middlemanId: middleman.id, requesterId: user.id, sellerId: user.id, buyerId: null }
      db.requests.push(item); addAudit(db, item.id, user.id, 'request_created', 'Customer created a middleman request'); db.messages.push({ id: randomBytes(10).toString('hex'), requestId: item.id, authorId: user.id, body: 'System: transaction room created.', system: true, createdAt: item.createdAt, readBy: [] }); await writeDb(db)
      return send(response, 201, { request: requestView(item, db) })
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
}

if (process.env.VERCEL !== '1') {
  const server = createServer(handler)
  server.listen(port, '0.0.0.0', () => console.log(`GameGuard API listening on http://0.0.0.0:${port}`))
}
