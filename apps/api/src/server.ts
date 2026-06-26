import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';

type Role = 'owner' | 'member';

interface PublicUser {
  id: string;
  email: string;
  nickname: string;
  name: string;
}

interface StoredUser extends PublicUser {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredProject {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  invitedMembers: string[];
}

interface CanvasPayload {
  nodes: unknown[];
  edges: unknown[];
  trashNodes: unknown[];
}

interface StoredCanvas {
  data: CanvasPayload;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  nickname: string;
  content: string;
  createdAt: string;
}

interface NodeHistoryItem {
  id: string;
  projectId: string;
  nodeId: string;
  userId: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  createdAt: string;
}

interface AppState {
  users: StoredUser[];
  projects: StoredProject[];
  canvases: Record<string, StoredCanvas>;
  messages: Record<string, ChatMessage[]>;
  histories: Record<string, NodeHistoryItem[]>;
}

interface JwtPayload {
  userId: string;
  email: string;
}

interface ProjectResponse extends StoredProject {
  role: Role;
  isOwner: boolean;
  nodeCount: number;
}

interface ProjectChangeEvent {
  projectId: string;
  action: 'created' | 'updated' | 'deleted' | 'restored' | 'invited';
  actorEmail: string;
}

const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || 'markflow-dev-secret';
const DATA_DIR = join(process.cwd(), 'data');
const DATA_FILE = join(DATA_DIR, 'state.json');
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  nickname: z.string().min(1).optional(),
  name: z.string().min(1).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const projectNameSchema = z.object({
  name: z.string().min(1).max(120)
});

const inviteSchema = z.object({
  email: z.string().email()
});

const profileSchema = z.object({
  nickname: z.string().min(1)
});

const canvasSchema = z.object({
  data: z.object({
    nodes: z.array(z.any()).default([]),
    edges: z.array(z.any()).default([]),
    trashNodes: z.array(z.any()).default([])
  })
});

const now = () => new Date().toISOString();
const normalizeEmail = (email: string) => email.trim().toLowerCase();

let io: SocketIOServer | null = null;

const broadcastProjectsUpdate = (payload: ProjectChangeEvent) => {
  io?.emit('projects-updated', payload);
};

const ensureDataDir = () => {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
};

const defaultState = (): AppState => ({
  users: [],
  projects: [],
  canvases: {},
  messages: {},
  histories: {}
});

const readState = (): AppState => {
  try {
    if (!existsSync(DATA_FILE)) {
      ensureDataDir();
      const initial = defaultState();
      writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }

    const raw = readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return defaultState();

    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users as StoredUser[] : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects as StoredProject[] : [],
      canvases: parsed.canvases && typeof parsed.canvases === 'object' ? parsed.canvases as Record<string, StoredCanvas> : {},
      messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages as Record<string, ChatMessage[]> : {},
      histories: parsed.histories && typeof parsed.histories === 'object' ? parsed.histories as Record<string, NodeHistoryItem[]> : {}
    };
  } catch {
    return defaultState();
  }
};

let state = readState();

const persistState = () => {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
};

const sanitizeUser = (user: StoredUser): PublicUser => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  name: user.name
});

const findUserByEmail = (email: string) => state.users.find((user) => user.email === normalizeEmail(email));
const findUserById = (id: string) => state.users.find((user) => user.id === id);

const getProjectCanvas = (projectId: string): StoredCanvas => {
  const existing = state.canvases[projectId];
  if (existing) return existing;
  const created: StoredCanvas = {
    data: { nodes: [], edges: [], trashNodes: [] },
    updatedAt: now()
  };
  state.canvases[projectId] = created;
  return created;
};

const projectNodeCount = (projectId: string) => {
  const canvas = state.canvases[projectId];
  return Array.isArray(canvas?.data.nodes) ? canvas.data.nodes.length : 0;
};

const projectRoleForUser = (project: StoredProject, user: StoredUser): Role | null => {
  if (project.ownerId === user.id) return 'owner';
  const userEmail = normalizeEmail(user.email);
  if (project.invitedMembers.some((member) => normalizeEmail(member) === userEmail)) return 'member';
  return null;
};

const toProjectResponse = (project: StoredProject, user: StoredUser): ProjectResponse => ({
  ...project,
  role: project.ownerId === user.id ? 'owner' : 'member',
  isOwner: project.ownerId === user.id,
  nodeCount: projectNodeCount(project.id)
});

const getAccessibleProjects = (user: StoredUser) => state.projects
  .filter((project) => !project.deletedAt && projectRoleForUser(project, user) !== null)
  .map((project) => toProjectResponse(project, user));

const getOwnedTrashProjects = (user: StoredUser) => state.projects
  .filter((project) => project.ownerId === user.id && !!project.deletedAt)
  .map((project) => toProjectResponse(project, user));

const extractToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
};

const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & Partial<JwtPayload>;
    if (!decoded.userId || !decoded.email) return null;
    return { userId: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
};

const createToken = (user: StoredUser) => jwt.sign({ userId: user.id, email: user.email } satisfies JwtPayload, JWT_SECRET, { expiresIn: '7d' });

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: '인증 토큰이 유효하지 않습니다.' });
    return;
  }

  const user = findUserById(payload.userId);
  if (!user || user.email !== normalizeEmail(payload.email)) {
    res.status(401).json({ error: '사용자 정보를 찾을 수 없습니다.' });
    return;
  }

  res.locals.user = user;
  next();
};

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS 차단됨'));
  },
  credentials: true
}));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'markflow-api' });
});

app.post(['/api/auth/register', '/api/auth/signup'], (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 확인해주세요.' });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    return;
  }

  const nickname = parsed.data.nickname || parsed.data.name || email.split('@')[0] || '사용자';
  const passwordHash = bcrypt.hashSync(parsed.data.password, 10);
  const user: StoredUser = {
    id: randomUUID(),
    email,
    nickname,
    name: nickname,
    passwordHash,
    createdAt: now(),
    updatedAt: now()
  };

  state.users.push(user);
  persistState();

  const token = createToken(user);
  res.status(201).json({
    token,
    accessToken: token,
    user: sanitizeUser(user),
    message: '회원가입이 완료되었습니다.'
  });
});

app.post('/api/auth/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '이메일과 비밀번호를 확인해주세요.' });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return;
  }

  const token = createToken(user);
  res.json({ token, accessToken: token, user: sanitizeUser(user) });
});

app.get('/api/auth/me', requireAuth, (_req, res) => {
  const user = res.locals.user as StoredUser;
  res.json({ user: sanitizeUser(user) });
});

app.put('/api/auth/profile', requireAuth, (req, res) => {
  const parsed = profileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '닉네임을 확인해주세요.' });
    return;
  }

  const user = res.locals.user as StoredUser;
  user.nickname = parsed.data.nickname;
  user.name = parsed.data.nickname;
  user.updatedAt = now();
  persistState();
  res.json({ user: sanitizeUser(user) });
});

app.get('/api/projects', requireAuth, (_req, res) => {
  const user = res.locals.user as StoredUser;
  res.json(getAccessibleProjects(user));
});

app.post('/api/projects', requireAuth, (req, res) => {
  const parsed = projectNameSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '프로젝트 이름을 입력해주세요.' });
    return;
  }

  const user = res.locals.user as StoredUser;
  const project: StoredProject = {
    id: randomUUID(),
    name: parsed.data.name.trim(),
    ownerId: user.id,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    invitedMembers: []
  };

  state.projects.push(project);
  getProjectCanvas(project.id);
  persistState();
  broadcastProjectsUpdate({ projectId: project.id, action: 'created', actorEmail: user.email });

  res.status(201).json({ project: toProjectResponse(project, user) });
});

app.put('/api/projects/:projectId', requireAuth, (req, res) => {
  const parsed = projectNameSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '프로젝트 이름을 입력해주세요.' });
    return;
  }

  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  if (project.ownerId !== user.id) {
    res.status(403).json({ error: '프로젝트 이름은 소유자만 변경할 수 있습니다.' });
    return;
  }

  project.name = parsed.data.name.trim();
  project.updatedAt = now();
  persistState();
  broadcastProjectsUpdate({ projectId: project.id, action: 'updated', actorEmail: user.email });
  res.json({ id: project.id, name: project.name, updatedAt: project.updatedAt });
});

app.delete('/api/projects/:projectId', requireAuth, (req, res) => {
  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  if (project.ownerId !== user.id) {
    res.status(403).json({ error: '프로젝트는 소유자만 삭제할 수 있습니다.' });
    return;
  }

  project.deletedAt = now();
  project.updatedAt = now();
  persistState();
  broadcastProjectsUpdate({ projectId: project.id, action: 'deleted', actorEmail: user.email });
  res.json({ id: project.id, deletedAt: project.deletedAt });
});

app.get('/api/projects/trash', requireAuth, (_req, res) => {
  const user = res.locals.user as StoredUser;
  res.json(getOwnedTrashProjects(user));
});

app.post('/api/projects/:projectId/restore', requireAuth, (req, res) => {
  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  if (project.ownerId !== user.id) {
    res.status(403).json({ error: '프로젝트는 소유자만 복구할 수 있습니다.' });
    return;
  }

  project.deletedAt = null;
  project.updatedAt = now();
  persistState();
  broadcastProjectsUpdate({ projectId: project.id, action: 'restored', actorEmail: user.email });
  res.json({ id: project.id, deletedAt: project.deletedAt });
});

app.post('/api/projects/:projectId/invite', requireAuth, (req, res) => {
  const parsed = inviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '초대할 이메일을 입력해주세요.' });
    return;
  }

  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  if (project.ownerId !== user.id) {
    res.status(403).json({ error: '프로젝트 초대는 소유자만 가능합니다.' });
    return;
  }
  if (project.deletedAt) {
    res.status(409).json({ error: '삭제된 프로젝트에는 초대할 수 없습니다.' });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const invitedMembers = new Set(project.invitedMembers.map((member) => normalizeEmail(member)));
  invitedMembers.add(email);
  project.invitedMembers = Array.from(invitedMembers);
  project.updatedAt = now();
  persistState();
  broadcastProjectsUpdate({ projectId: project.id, action: 'invited', actorEmail: user.email });

  res.json({
    id: project.id,
    invitedMembers: project.invitedMembers,
    message: `${email} 님을 초대했습니다.`,
    success: true
  });
});

app.get('/api/projects/:projectId/canvas', requireAuth, (req, res) => {
  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  if (!projectRoleForUser(project, user)) {
    res.status(403).json({ error: '캔버스를 조회할 권한이 없습니다.' });
    return;
  }

  const canvas = getProjectCanvas(project.id);
  res.json({ data: canvas.data, updatedAt: canvas.updatedAt });
});

app.post('/api/projects/:projectId/canvas', requireAuth, (req, res) => {
  const parsed = canvasSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: '캔버스 데이터를 확인해주세요.' });
    return;
  }

  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project) {
    res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    return;
  }
  if (!projectRoleForUser(project, user)) {
    res.status(403).json({ error: '캔버스를 저장할 권한이 없습니다.' });
    return;
  }

  state.canvases[project.id] = {
    data: {
      nodes: parsed.data.data.nodes,
      edges: parsed.data.data.edges,
      trashNodes: parsed.data.data.trashNodes
    },
    updatedAt: now()
  };
  project.updatedAt = now();
  persistState();
  res.json({ success: true, updatedAt: state.canvases[project.id].updatedAt });
});

app.get('/api/projects/:projectId/messages', requireAuth, (req, res) => {
  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectRoleForUser(project, user)) {
    res.json([]);
    return;
  }

  res.json(state.messages[project.id] || []);
});

app.get('/api/projects/:projectId/history', requireAuth, (req, res) => {
  const user = res.locals.user as StoredUser;
  const project = state.projects.find((item) => item.id === req.params.projectId);
  if (!project || !projectRoleForUser(project, user)) {
    res.json([]);
    return;
  }

  res.json(state.histories[project.id] || []);
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const httpServer = createServer(app);
io = new SocketIOServer(httpServer, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS 차단됨'));
    },
    credentials: true
  }
});

io.on('connection', (socket) => {
  socket.on('join-project', ({ projectId }) => {
    if (typeof projectId === 'string' && projectId) {
      socket.join(projectId);
    }
  });

  socket.on('leave-project', ({ projectId }) => {
    if (typeof projectId === 'string' && projectId) {
      socket.leave(projectId);
    }
  });

  socket.on('cursor-move', (payload) => {
    if (payload?.projectId) {
      socket.to(payload.projectId).emit('cursor-update', {
        socketId: socket.id,
        email: payload.email,
        nickname: payload.nickname,
        x: payload.x,
        y: payload.y
      });
    }
  });

  socket.on('node-lock', (payload) => {
    if (payload?.projectId) {
      socket.to(payload.projectId).emit('node-locked', {
        nodeId: payload.nodeId,
        email: payload.email
      });
    }
  });

  socket.on('node-unlock', (payload) => {
    if (payload?.projectId) {
      socket.to(payload.projectId).emit('node-unlocked', {
        nodeId: payload.nodeId
      });
    }
  });

  socket.on('nodes-change', (payload) => {
    if (!payload?.projectId) return;
    const canvas = getProjectCanvas(payload.projectId);
    canvas.data = {
      nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
      edges: canvas.data.edges,
      trashNodes: canvas.data.trashNodes
    };
    canvas.updatedAt = now();
    const project = state.projects.find((item) => item.id === payload.projectId);
    if (project) project.updatedAt = now();
    persistState();
    socket.to(payload.projectId).emit('nodes-update', payload.nodes);
  });

  socket.on('edges-change', (payload) => {
    if (!payload?.projectId) return;
    const canvas = getProjectCanvas(payload.projectId);
    canvas.data = {
      nodes: canvas.data.nodes,
      edges: Array.isArray(payload.edges) ? payload.edges : [],
      trashNodes: canvas.data.trashNodes
    };
    canvas.updatedAt = now();
    const project = state.projects.find((item) => item.id === payload.projectId);
    if (project) project.updatedAt = now();
    persistState();
    socket.to(payload.projectId).emit('edges-update', payload.edges);
  });

  socket.on('chat-message', (payload) => {
    if (!payload?.projectId || !payload?.content) return;
    const message: ChatMessage = {
      id: randomUUID(),
      projectId: payload.projectId,
      userId: payload.userId || socket.id,
      email: payload.email || 'unknown@example.com',
      nickname: payload.nickname || '사용자',
      content: String(payload.content),
      createdAt: now()
    };
    state.messages[payload.projectId] = [...(state.messages[payload.projectId] || []), message];
    persistState();
    io.to(payload.projectId).emit('chat-broadcast', message);
  });

  socket.on('node-history-action', (payload) => {
    if (!payload?.projectId || !payload?.nodeId || !payload?.action) return;
    const history: NodeHistoryItem = {
      id: randomUUID(),
      projectId: payload.projectId,
      nodeId: payload.nodeId,
      userId: payload.userId || socket.id,
      userEmail: payload.userEmail || 'unknown@example.com',
      action: payload.action,
      createdAt: now()
    };
    state.histories[payload.projectId] = [history, ...(state.histories[payload.projectId] || [])];
    persistState();
    io.to(payload.projectId).emit('history-update-broadcast', history);
  });

  socket.on('disconnect', () => {
    socket.removeAllListeners();
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[markflow-api] listening on http://127.0.0.1:${PORT}`);
});
