// backend/src/routes/projects.ts
import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthRequest } from '../middlewares/auth.js';

const router = Router();

// 모든 프로젝트 라우트에 JWT 인증 미들웨어 적용
router.use(authenticateToken);

// 1. 프로젝트 목록 조회 (내 소유 + 내가 멤버로 속한 프로젝트 중 deletedAt이 NULL인 활성 프로젝트)
router.get('/', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;

  try {
    const memberships = await prisma.projectMember.findMany({
      where: {
        userId,
        project: {
          deletedAt: null // 활성 상태 프로젝트만
        }
      },
      include: {
        project: true
      }
    });

    const projects = memberships.map(m => ({
      id: m.project.id,
      name: m.project.name,
      ownerId: m.project.ownerId,
      createdAt: m.project.createdAt,
      role: m.role // "owner" 또는 "member"
    }));

    return res.json(projects);
  } catch (error) {
    console.error('프로젝트 목록 조회 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 2. 새 프로젝트 생성
router.post('/', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '프로젝트 이름을 입력해주세요.' });
  }

  try {
    // 트랜잭션 사용: 프로젝트 생성 + 소유자 멤버 등록 + 기본 빈 캔버스 데이터 생성
    const newProject = await prisma.$transaction(async (tx) => {
      // 프로젝트 레코드 생성
      const project = await tx.project.create({
        data: {
          name,
          ownerId: userId!
        }
      });

      // 프로젝트 멤버 매핑에 소유자로 등록
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: userId!,
          role: 'owner'
        }
      });

      // 캔버스 초기 데이터 생성 (비어있는 {nodes: [], edges: []} 문자열)
      const initialCanvasData = JSON.stringify({ nodes: [], edges: [] });
      await tx.canvas.create({
        data: {
          projectId: project.id,
          data: initialCanvasData
        }
      });

      return project;
    });

    return res.status(201).json({
      message: '프로젝트가 성공적으로 생성되었습니다.',
      project: newProject
    });

  } catch (error) {
    console.error('프로젝트 생성 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 3. 프로젝트 이름 변경 (Owner 전용)
router.put('/:projectId', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '변경할 프로젝트 이름을 입력해주세요.' });
  }

  try {
    // 권한 확인 (owner 인지 체크)
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo || memberInfo.role !== 'owner') {
      return res.status(403).json({ error: '프로젝트 소유자만 이름을 변경할 수 있습니다.' });
    }

    // 이름 수정
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { name }
    });

    return res.json({
      message: '프로젝트 이름이 변경되었습니다.',
      project: updatedProject
    });

  } catch (error) {
    console.error('프로젝트 이름 변경 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 4. 프로젝트 소프트 삭제 (Owner 전용)
router.delete('/:projectId', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;

  try {
    // 권한 확인
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo || memberInfo.role !== 'owner') {
      return res.status(403).json({ error: '프로젝트 소유자만 프로젝트를 삭제할 수 있습니다.' });
    }

    // deletedAt 설정으로 소프트 삭제 처리
    await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() }
    });

    return res.json({ message: '프로젝트가 휴지통으로 이동되었습니다.' });

  } catch (error) {
    console.error('프로젝트 삭제 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 5. 프로젝트 멤버 초대 (Owner 전용)
router.post('/:projectId/invite', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  const { email } = req.body;

  if (!email || email.trim() === '') {
    return res.status(400).json({ error: '초대할 사용자의 이메일을 입력해주세요.' });
  }

  try {
    // 1. 소유자 권한 체크
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo || memberInfo.role !== 'owner') {
      return res.status(403).json({ error: '프로젝트 소유자만 멤버를 초대할 수 있습니다.' });
    }

    // 2. 초대할 사용자 가입 여부 확인
    const invitee = await prisma.user.findUnique({
      where: { email }
    });

    if (!invitee) {
      return res.status(404).json({ error: '존재하지 않는 가입자 이메일입니다.' });
    }

    // 3. 이미 초대/가입된 멤버인지 확인
    const alreadyMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: invitee.id }
      }
    });

    if (alreadyMember) {
      return res.status(400).json({ error: '이미 프로젝트에 참여 중인 멤버입니다.' });
    }

    // 4. 멤버로 등록
    await prisma.projectMember.create({
      data: {
        projectId,
        userId: invitee.id,
        role: 'member'
      }
    });

    return res.status(201).json({ message: `${email} 님이 프로젝트 멤버로 성공적으로 초대되었습니다.` });

  } catch (error) {
    console.error('멤버 초대 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 6. 휴지통 조회 (소프트 삭제된 내 프로젝트 목록 조회)
router.get('/trash', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;

  try {
    // 사용자가 소유자(owner)이며 deletedAt이 설정된 프로젝트 조회
    const trashProjects = await prisma.project.findMany({
      where: {
        ownerId: userId!,
        deletedAt: {
          not: null
        }
      },
      orderBy: {
        deletedAt: 'desc'
      }
    });

    return res.json(trashProjects);
  } catch (error) {
    console.error('휴지통 조회 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 7. 프로젝트 복구 (Owner 전용)
router.post('/:projectId/restore', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;

  try {
    // 권한 확인 (소유자 여부)
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: '존재하지 않는 프로젝트입니다.' });
    }

    if (project.ownerId !== userId) {
      return res.status(403).json({ error: '프로젝트 소유자만 복구할 수 있습니다.' });
    }

    // deletedAt 초기화
    const restoredProject = await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: null }
    });

    return res.json({
      message: '프로젝트가 성공적으로 복구되었습니다.',
      project: restoredProject
    });

  } catch (error) {
    console.error('프로젝트 복구 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 8. 캔버스 데이터 조회
router.get('/:projectId/canvas', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;

  try {
    // 프로젝트 참여 권한 체크
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo) {
      return res.status(403).json({ error: '프로젝트에 접근할 권한이 없습니다.' });
    }

    const canvas = await prisma.canvas.findUnique({
      where: { projectId }
    });

    if (!canvas) {
      return res.status(404).json({ error: '캔버스 데이터를 찾을 수 없습니다.' });
    }

    // JSON 문자열을 파싱하여 클라이언트에 반환
    const parsedData = JSON.parse(canvas.data as string);
    return res.json({
      id: canvas.id,
      projectId: canvas.projectId,
      data: parsedData,
      updatedAt: canvas.updatedAt
    });

  } catch (error) {
    console.error('캔버스 조회 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 9. 캔버스 데이터 저장 (upsert / update)
router.post('/:projectId/canvas', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  const { data } = req.body; // { nodes: [...], edges: [...] }

  if (!data) {
    return res.status(400).json({ error: '저장할 캔버스 데이터를 전달해주세요.' });
  }

  try {
    // 프로젝트 참여 권한 체크
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo) {
      return res.status(403).json({ error: '프로젝트 편집 권한이 없습니다.' });
    }

    // SQLite 저장을 위해 JSON 문자열로 직렬화
    const serializedData = JSON.stringify(data);

    // 캔버스 데이터 업데이트 또는 생성
    const canvas = await prisma.canvas.upsert({
      where: { projectId },
      update: {
        data: serializedData
      },
      create: {
        projectId,
        data: serializedData
      }
    });

    return res.json({
      message: '캔버스가 성공적으로 저장되었습니다.',
      canvas: {
        id: canvas.id,
        projectId: canvas.projectId,
        data: JSON.parse(canvas.data as string),
        updatedAt: canvas.updatedAt
      }
    });

  } catch (error) {
    console.error('캔버스 저장 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 10. 프로젝트 채팅 이력 조회
router.get('/:projectId/messages', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;

  try {
    // 프로젝트 참여 권한 체크
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo) {
      return res.status(403).json({ error: '프로젝트 대화 기록에 접근할 권한이 없습니다.' });
    }

    // 채팅 메시지 조회 (오래된 대화부터 순서대로 정렬)
    const messages = await prisma.message.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return res.json(messages.map(msg => ({
      id: msg.id,
      projectId: msg.projectId,
      userId: msg.userId,
      email: msg.user.email,
      content: msg.content,
      createdAt: msg.createdAt
    })));

  } catch (error) {
    console.error('채팅 메시지 조회 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 11. 프로젝트 노드 히스토리 변경 로그 조회
router.get('/:projectId/history', async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user?.id;
  const { projectId } = req.params;

  try {
    // 프로젝트 참여 권한 체크
    const memberInfo = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: userId! }
      }
    });

    if (!memberInfo) {
      return res.status(403).json({ error: '프로젝트 히스토리에 접근할 권한이 없습니다.' });
    }

    // 시간 역순으로 변경 이력 조회
    const histories = await prisma.nodeHistory.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(histories);

  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

export default router;
