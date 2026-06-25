// backend/src/routes/auth.ts
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { AuthRequest, authenticateToken } from '../middlewares/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'markflow_secret_key_1234!';

// 이메일 정규식 및 비밀번호(8자 이상, 영문+숫자 혼합) 정규식
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

// 회원가입
router.post('/register', async (req, res): Promise<any> => {
  const { email, password, nickname } = req.body;

  if (!email || !password || !nickname) {
    return res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 모두 입력해주세요.' });
  }

  if (nickname.trim().length < 2) {
    return res.status(400).json({ error: '닉네임은 최소 2자 이상 입력해주세요.' });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '유효한 이메일 형식이 아닙니다.' });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이며 영문과 숫자를 조합해야 합니다.' });
  }

  try {
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 10);

    // 신규 유저 생성
    const user = await prisma.user.create({
      data: {
        email,
        nickname: nickname.trim(),
        passwordHash
      }
    });

    return res.status(201).json({
      message: '회원가입이 완료되었습니다. 로그인을 진행해주세요.',
      user: { id: user.id, email: user.email, nickname: user.nickname }
    });

  } catch (error) {
    console.error('회원가입 중 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    // 유저 확인
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ error: '존재하지 않는 이메일이거나 비밀번호가 틀렸습니다.' });
    }

    // 비밀번호 비교
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: '존재하지 않는 이메일이거나 비밀번호가 틀렸습니다.' });
    }

    // JWT 서명 및 반환
    const token = jwt.sign(
      { id: user.id, email: user.email, nickname: user.nickname },
      JWT_SECRET,
      { expiresIn: '7d' } // 7일 유효
    );

    return res.json({
      message: '로그인에 성공했습니다.',
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname }
    });

  } catch (error) {
    console.error('로그인 중 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 현재 로그인 유저 정보 조회
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

// 프로필(닉네임) 수정
router.put('/profile', authenticateToken, async (req: AuthRequest, res): Promise<any> => {
  const { nickname } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: '인증되지 않은 사용자입니다.' });
  }

  if (!nickname || nickname.trim().length < 2) {
    return res.status(400).json({ error: '닉네임은 2자 이상 입력해주세요.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { nickname: nickname.trim() }
    });

    return res.json({
      message: '프로필이 수정되었습니다.',
      user: { id: updatedUser.id, email: updatedUser.email, nickname: updatedUser.nickname }
    });
  } catch (error) {
    console.error('프로필 수정 중 오류:', error);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

export default router;
