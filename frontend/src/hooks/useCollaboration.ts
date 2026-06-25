// frontend/src/hooks/useCollaboration.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';
import { useProjectStore } from '../store/projectStore.js';
import { useCanvasStore, type MarkdownNodeData } from '../store/canvasStore.js';
import type { Node, Edge } from '@xyflow/react';

export interface Cursor {
  email: string;
  nickname: string;
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  email: string;
  nickname: string;
  content: string;
  createdAt: string;
}

export interface NodeHistoryItem {
  id: string;
  projectId: string;
  nodeId: string;
  userId: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  createdAt: string;
}

const SOCKET_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api';

export const useCollaboration = () => {
  const { user, token } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { updateNodeData } = useCanvasStore();

  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [histories, setHistories] = useState<NodeHistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const lastCursorEmitRef = useRef<number>(0);

  // 1. 소켓 연결 및 이벤트 바인딩
  useEffect(() => {
    if (!currentProject || !user) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      forceNew: true
    });
    socketRef.current = socket;

    // 프로젝트 룸 조인
    socket.emit('join-project', {
      projectId: currentProject.id,
      email: user.email,
      nickname: user.nickname
    });

    // 백엔드 대화 이력 API 호출
    fetch(`${API_URL}/projects/${currentProject.id}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then((data: ChatMessage[]) => {
        if (Array.isArray(data)) setChatMessages(data);
      })
      .catch(err => console.error('대화 이력 조회 실패:', err));

    // 백엔드 변경 이력(히스토리) API 호출
    fetch(`${API_URL}/projects/${currentProject.id}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then((data: NodeHistoryItem[]) => {
        if (Array.isArray(data)) setHistories(data);
      })
      .catch(err => console.error('변경 이력 조회 실패:', err));

    socket.on('connect', () => {
      setIsOnline(true);
      console.log('실시간 협업 서버 연결 성공');
    });

    socket.on('disconnect', () => {
      setIsOnline(false);
      console.log('실시간 협업 서버 연결 해제');
    });

    socket.on('cursor-update', ({ socketId, email, nickname, x, y }) => {
      setCursors(prev => ({
        ...prev,
        [socketId]: { email, nickname, x, y }
      }));
    });

    socket.on('cursor-remove', ({ socketId }) => {
      setCursors(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on('nodes-update', (updatedNodes: Node<MarkdownNodeData>[]) => {
      const store = useCanvasStore.getState();
      store.setIncomingUpdate(true);
      useCanvasStore.setState({ nodes: updatedNodes });
      setTimeout(() => {
        useCanvasStore.getState().setIncomingUpdate(false);
      }, 50);
    });

    socket.on('edges-update', (updatedEdges: Edge[]) => {
      const store = useCanvasStore.getState();
      store.setIncomingUpdate(true);
      useCanvasStore.setState({ edges: updatedEdges });
      setTimeout(() => {
        useCanvasStore.getState().setIncomingUpdate(false);
      }, 50);
    });

    socket.on('node-locked', ({ nodeId, email }) => {
      updateNodeData(nodeId, { editingUser: email });
    });

    socket.on('node-unlocked', ({ nodeId }) => {
      updateNodeData(nodeId, { editingUser: undefined });
    });

    socket.on('chat-broadcast', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    // 실시간 히스토리 업데이트 수신
    socket.on('history-update-broadcast', (history: NodeHistoryItem) => {
      setHistories(prev => [history, ...prev]); // 최신 항목이 맨 위로 오도록 추가
    });

    return () => {
      socket.emit('leave-project', {
        projectId: currentProject.id,
        email: user.email,
        nickname: user.nickname
      });
      socket.disconnect();
      socketRef.current = null;
      setCursors({});
      setChatMessages([]);
      setHistories([]);
      setIsOnline(false);
    };
  }, [currentProject, user]);

  const emitNodeChange = useCallback((updatedNodes: Node<MarkdownNodeData>[]) => {
    if (socketRef.current && currentProject) {
      socketRef.current.emit('nodes-change', {
        projectId: currentProject.id,
        nodes: updatedNodes
      });
    }
  }, [currentProject]);

  const emitEdgeChange = useCallback((updatedEdges: Edge[]) => {
    if (socketRef.current && currentProject) {
      socketRef.current.emit('edges-change', {
        projectId: currentProject.id,
        edges: updatedEdges
      });
    }
  }, [currentProject]);

  const emitCursorMove = useCallback((x: number, y: number) => {
    if (!socketRef.current || !currentProject || !user) return;

    const now = Date.now();
    if (now - lastCursorEmitRef.current > 50) {
      socketRef.current.emit('cursor-move', {
        projectId: currentProject.id,
        x,
        y,
        email: user.email,
        nickname: user.nickname
      });
      lastCursorEmitRef.current = now;
    }
  }, [currentProject, user]);

  const lockNode = useCallback((nodeId: string) => {
    if (socketRef.current && currentProject && user) {
      socketRef.current.emit('node-lock', {
        projectId: currentProject.id,
        nodeId,
        email: user.email
      });
      updateNodeData(nodeId, { editingUser: user.email });
    }
  }, [currentProject, user]);

  const unlockNode = useCallback((nodeId: string) => {
    if (socketRef.current && currentProject) {
      socketRef.current.emit('node-unlock', {
        projectId: currentProject.id,
        nodeId
      });
      updateNodeData(nodeId, { editingUser: undefined });
    }
  }, [currentProject]);

  const emitChatMessage = useCallback((content: string) => {
    if (socketRef.current && currentProject && user) {
      socketRef.current.emit('chat-message', {
        projectId: currentProject.id,
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        content
      });
    }
  }, [currentProject, user]);

  // 8. 노드 변경 이력(히스토리) 이벤트 발송
  const emitNodeHistoryAction = useCallback((nodeId: string, action: 'create' | 'update' | 'delete' | 'restore') => {
    if (socketRef.current && currentProject && user) {
      socketRef.current.emit('node-history-action', {
        projectId: currentProject.id,
        nodeId,
        action,
        userId: user.id,
        userEmail: user.email
      });
    }
  }, [currentProject, user]);

  return {
    isOnline,
    cursors,
    chatMessages,
    histories,
    emitNodeChange,
    emitEdgeChange,
    emitCursorMove,
    lockNode,
    unlockNode,
    emitChatMessage,
    emitNodeHistoryAction
  };
};
