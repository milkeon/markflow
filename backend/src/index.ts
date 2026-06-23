// backend/src/index.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// 환경 변수 로드
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS 설정
app.use(cors({
  origin: '*', // 개발 단계이므로 전체 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// JSON body 파서
app.use(express.json());

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// 라우터 임포트
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';

// 라우터 등록
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

// 기본 헬스 체크 라우트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MarkFlow 백엔드 서버가 정상 작동 중입니다.' });
});

// Socket.io 초기화
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 소켓 실시간 동기화 이벤트 핸들러
io.on('connection', (socket) => {
  console.log(`소켓 연결 성공: ${socket.id}`);

  // 프로젝트 협업 룸 가입
  socket.on('join-project', ({ projectId, email }) => {
    socket.join(projectId);
    console.log(`사용자 [${email}]이(가) 프로젝트 룸 [${projectId}]에 참가했습니다. (소켓 ID: ${socket.id})`);
    
    // 새 멤버 참가 브로드캐스트 (알림용)
    socket.to(projectId).emit('member-joined', { email });
  });

  // 1. 실시간 마우스 커서 좌표 공유 (50ms 쓰로틀링으로 수신)
  socket.on('cursor-move', ({ projectId, x, y, email }) => {
    socket.to(projectId).emit('cursor-update', { socketId: socket.id, email, x, y });
  });

  // 2. 실시간 노드 동기화 (최종 수정자 우선)
  socket.on('nodes-change', ({ projectId, nodes }) => {
    socket.to(projectId).emit('nodes-update', nodes);
  });

  // 3. 실시간 연결선(엣지) 동기화
  socket.on('edges-change', ({ projectId, edges }) => {
    socket.to(projectId).emit('edges-update', edges);
  });

  // 4. 노드 편집 소프트 락 (동시 편집 충돌 방지)
  socket.on('node-lock', ({ projectId, nodeId, email }) => {
    socket.to(projectId).emit('node-locked', { nodeId, email });
    console.log(`프로젝트 [${projectId}] - 노드 [${nodeId}] 잠김 설정자: [${email}]`);
  });

  // 5. 노드 편집 소프트 락 해제
  socket.on('node-unlock', ({ projectId, nodeId }) => {
    socket.to(projectId).emit('node-unlocked', { nodeId });
    console.log(`프로젝트 [${projectId}] - 노드 [${nodeId}] 잠금 해제`);
  });

  // 6. 실시간 채팅 수신 및 DB 영속화
  socket.on('chat-message', async ({ projectId, userId, email, content }) => {
    if (!content || content.trim() === '') return;

    try {
      const message = await prisma.message.create({
        data: {
          projectId,
          userId,
          content
        }
      });

      io.to(projectId).emit('chat-broadcast', {
        id: message.id,
        projectId,
        userId,
        email,
        content: message.content,
        createdAt: message.createdAt
      });

    } catch (err) {
      console.error('실시간 채팅 동기화 오류:', err);
    }
  });

  // 7. 노드 변경 이력(히스토리) 기록 및 공유
  socket.on('node-history-action', async ({ projectId, nodeId, action, userId, userEmail }) => {
    try {
      const history = await prisma.nodeHistory.create({
        data: {
          projectId,
          nodeId,
          action,
          userId,
          userEmail
        }
      });

      // 동일 룸에 변경 이력 업데이트 브로드캐스트
      io.to(projectId).emit('history-update-broadcast', history);
      console.log(`히스토리 기록 완료: 프로젝트 [${projectId}] - 노드 [${nodeId}] - 액션 [${action}] by [${userEmail}]`);
    } catch (err) {
      console.error('히스토리 기록 오류:', err);
    }
  });

  // 프로젝트 이탈
  socket.on('leave-project', ({ projectId, email }) => {
    socket.leave(projectId);
    console.log(`사용자 [${email}]이(가) 프로젝트 룸 [${projectId}]을(를) 떠났습니다.`);
    socket.to(projectId).emit('cursor-remove', { socketId: socket.id });
  });

  // 소켓 끊김
  socket.on('disconnect', () => {
    console.log(`소켓 연결 종료: ${socket.id}`);
    io.emit('cursor-remove', { socketId: socket.id });
  });
});

// 서버 포트 설정 및 구동
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`MarkFlow 백엔드 서버가 포트 ${PORT}에서 작동 중입니다.`);
});

export { app, server, io, prisma };
