// frontend/src/components/CanvasWorkspace.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { useCanvasStore } from '../store/canvasStore.js';
import { useProjectStore } from '../store/projectStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useCollaboration } from '../hooks/useCollaboration.js';
import { MarkdownNode } from './MarkdownNode.js';
import MDEditor from '@uiw/react-md-editor';
import {
  Plus, Maximize, Save, Trash2, ArrowLeft,
  MessageSquare, Send, X, Download, History, Clock,
  ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut, MoreVertical,
  AlertTriangle, RotateCcw, Settings
} from 'lucide-react';
import JSZip from 'jszip';

import '@xyflow/react/dist/style.css';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

// React Flow 커스텀 노드 타입 매핑 등록
const nodeTypes = {
  markdown: MarkdownNode
};

const CanvasInner: React.FC = () => {
  const {
    nodes,
    trashNodes,
    edges,
    isLoading,
    isSaving,
    loadCanvas,
    saveCanvas,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addMarkdownNode,
    getDeletedNodes,
    restoreNode,
    updateNodeData,
    softDeleteNode
  } = useCanvasStore();

  const { currentProject, selectProject, showToast } = useProjectStore();
  const { user, updateProfile } = useAuthStore();
  const { screenToFlowPosition, flowToScreenPosition, fitView, setCenter, zoomIn, zoomOut, zoomTo } = useReactFlow();

  // 1. 실시간 협업 훅 호출
  const {
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
  } = useCollaboration();

  // UI 상태 관리
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'history'>('chat');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentZoom, setCurrentZoom] = useState(1);

  // 마크다운 상세 에디터 모달 상태
  const [activeEditingNodeId, setActiveEditingNodeId] = useState<string | null>(null);
  // 에디터 모달 내 플로팅 팀 채팅 오버레이 상태
  const [isModalChatOpen, setIsModalChatOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  // 추가 팝업 및 상태
  const [isNodeTrashOpen, setIsNodeTrashOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // 미리보기 노드 ID
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);

  // 노드 리스트 멀티선택 상태
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // 프로필 수정 상태
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');

  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const modalChatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const modalChatInputRef = useRef<HTMLInputElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuPanelRef = useRef<HTMLDivElement>(null);
  const [moreMenuStyle, setMoreMenuStyle] = useState<React.CSSProperties>({});

  // 현재 프로젝트 캔버스 로딩
  useEffect(() => {
    if (currentProject) {
      loadCanvas(currentProject.id);
    }
  }, [currentProject]);

  // 로컬 노드/엣지 변경 시 실시간 동기화 (수신된 패치가 아닐 때만 발송)
  const isIncomingUpdate = useCanvasStore((state) => state.isIncomingUpdate);

  useEffect(() => {
    if (nodes.length > 0 && !isIncomingUpdate) {
      emitNodeChange(nodes);
    }
  }, [nodes, emitNodeChange, isIncomingUpdate]);

  useEffect(() => {
    if (edges.length > 0 && !isIncomingUpdate) {
      emitEdgeChange(edges);
    }
  }, [edges, emitEdgeChange, isIncomingUpdate]);

  // 엣지 더블클릭 삭제 핸들러 (삭제 즉시 onEdgesChange를 통해 useEffect에서 발송됨)
  const handleEdgeDoubleClick = (_event: any, edge: any) => {
    const confirmDelete = window.confirm('이 연결선을 삭제하시겠습니까?');
    if (confirmDelete) {
      onEdgesChange([{ id: edge.id, type: 'remove' }]);
      showToast('연결선이 삭제되었습니다.', 'info');
    }
  };

  // 프로필 수정 폼 서밋 핸들러
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname.trim() || newNickname.trim().length < 2) {
      showToast('닉네임은 2자 이상 입력해주세요.', 'error');
      return;
    }

    const confirmUpdate = window.confirm(`닉네임을 "${newNickname}"(으)로 변경하시겠습니까?`);
    if (!confirmUpdate) return;

    const success = await updateProfile(newNickname);
    if (success) {
      showToast('프로필이 수정되었습니다.', 'success');
      setIsProfileEditOpen(false);
    } else {
      showToast('프로필 수정에 실패했습니다.', 'error');
    }
  };

  const profileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isProfileEditOpen && profileInputRef.current) {
      profileInputRef.current.focus();
    }
  }, [isProfileEditOpen]);

  // 대화 목록 추가 시 최하단으로 자동 스크롤
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isRightPanelOpen, rightPanelTab]);

  useEffect(() => {
    if (modalChatEndRef.current) {
      modalChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isModalChatOpen]);

  // 채팅 패널 활성화 시 입력창 자동 포커스
  useEffect(() => {
    if (isRightPanelOpen && rightPanelTab === 'chat' && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isRightPanelOpen, rightPanelTab]);

  useEffect(() => {
    if (isModalChatOpen && modalChatInputRef.current) {
      modalChatInputRef.current.focus();
    }
  }, [isModalChatOpen]);

  // 안 읽은 메시지 카운팅 이펙트
  const prevMessagesCountRef = useRef(chatMessages.length);
  useEffect(() => {
    const isChatActive = isRightPanelOpen && rightPanelTab === 'chat';
    if (chatMessages.length > prevMessagesCountRef.current) {
      if (!isChatActive) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && lastMsg.email !== user?.email) {
          setUnreadChatCount(prev => prev + 1);
        }
      }
    }
    prevMessagesCountRef.current = chatMessages.length;
  }, [chatMessages, isRightPanelOpen, rightPanelTab, user]);

  useEffect(() => {
    if (isRightPanelOpen && rightPanelTab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [isRightPanelOpen, rightPanelTab]);

  // 실시간 유니크 접속자 리스트 계산
  const activeParticipants = useMemo(() => {
    const list = [];
    if (user) {
      list.push({
        email: user.email,
        nickname: user.nickname || user.email.split('@')[0],
        isMe: true
      });
    }
    const seenEmails = new Set(user ? [user.email] : []);
    Object.values(cursors).forEach(c => {
      if (c.email && !seenEmails.has(c.email)) {
        seenEmails.add(c.email);
        list.push({
          email: c.email,
          nickname: c.nickname || c.email.split('@')[0],
          isMe: false
        });
      }
    });
    return list;
  }, [user, cursors]);

  // 소프트 삭제되지 않은 활성 노드만 캔버스에 렌더링하도록 필터링 및 에디터오픈/검색 맵핑
  const activeNodes = useMemo(() => {
    return nodes
      .filter(node => node.data.deletedAt === undefined)
      .map(node => {
        // 검색 매칭 확인
        const isMatch = searchTerm === '' ||
          node.data.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.data.content.toLowerCase().includes(searchTerm.toLowerCase());

        return {
          ...node,
          style: {
            ...node.style,
            opacity: isMatch ? 1 : 0.3,
            transition: 'opacity 0.2s ease'
          },
          data: {
            ...node.data,
            lockNode,
            unlockNode,
            emitNodeHistoryAction,
            openEditor: (id: string) => {
              lockNode(id);
              setActiveEditingNodeId(id);
            }
          }
        };
      });
  }, [nodes, searchTerm, lockNode, unlockNode, emitNodeHistoryAction]);

  // 소프트 삭제된 노드 목록 캐싱 (임시 저장소 노드들)
  const deletedNodes = useMemo(() => {
    return getDeletedNodes();
  }, [trashNodes, getDeletedNodes]);

  const handleAddNode = (category?: 'idea' | 'document' | 'decision' | 'todo' | 'data') => {
    // 현재 뷰포트 중심을 캔버스 좌표로 변환하여 기준 위치로 사용
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    let baseX = 300;
    let baseY = 300;
    try {
      const flowPos = screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });
      baseX = flowPos.x;
      baseY = flowPos.y;
    } catch (_) {
      // 변환 실패 시 기본값 사용
    }

    const newId = addMarkdownNode(baseX, baseY, category);
    if (newId) {
      emitNodeHistoryAction(newId, 'create');
      showToast(`새 노드가 생성되었습니다.`, 'success');
      // 생성된 노드로 화면 이동 (store에서 실제 배치된 위치 기준)
      setTimeout(() => {
        const createdNode = useCanvasStore.getState().nodes.find(n => n.id === newId);
        if (createdNode) {
          handleFocusNode(createdNode);
        }
      }, 0);
    }
  };

  const handleManualSave = async () => {
    if (currentProject) {
      await saveCanvas(currentProject.id);
      showToast('캔버스가 안전하게 저장되었습니다.', 'success');
    }
  };

  const handleRestoreNodeClick = (nodeId: string) => {
    const success = restoreNode(nodeId);
    if (success) {
      emitNodeHistoryAction(nodeId, 'restore');
    }
  };

  // 노드 마크다운 문서를 ZIP으로 다운로드하는 내보내기 기능
  const handleExportZip = async () => {
    const activeNodesList = nodes.filter(node => node.data.deletedAt === undefined);
    if (activeNodesList.length === 0) {
      showToast('내보낼 마크다운 노드가 없습니다.', 'info');
      return;
    }

    const zip = new JSZip();

    activeNodesList.forEach((node) => {
      const sanitizedTitle = node.data.title.replace(/[\\/:*?"<>|]/g, '_').trim();
      const fileName = sanitizedTitle ? `${sanitizedTitle}.md` : `node_${node.id}.md`;
      const mdContent = `# ${node.data.title}\n\n${node.data.content}`;
      zip.file(fileName, mdContent);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = url;
      const projName = currentProject ? currentProject.name.replace(/[\\/:*?"<>|]/g, '_') : 'e-im';
      link.download = `${projName}_markdown_nodes.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('마크다운 ZIP 파일 다운로드를 완료했습니다.', 'success');
    } catch (err) {
      console.error('ZIP 내보내기 실패:', err);
      showToast('압축 파일 생성에 실패했습니다.', 'error');
    }
  };

  // 마우스 이동 시 좌표 전송 (React Flow 캔버스 좌표계로 매핑)
  const handlePointerMove = (e: React.PointerEvent) => {
    try {
      const coords = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      emitCursorMove(coords.x, coords.y);
    } catch (err) {
      // 리액트 플로우 컨테이너 미비 시 예외 방지
    }
  };

  useEffect(() => {
    if (!moreMenuOpen) return;

    const updateMoreMenuPosition = () => {
      const trigger = moreMenuButtonRef.current;
      const panel = moreMenuPanelRef.current;
      if (!trigger || !panel) return;

      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const gap = 10;
      const preferredTop = triggerRect.top - panelRect.height - gap;
      const top = Math.max(8, preferredTop);
      const left = Math.max(8, window.innerWidth - triggerRect.right);

      setMoreMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        right: `${left}px`,
        zIndex: 9999,
      });
    };

    const raf = window.requestAnimationFrame(updateMoreMenuPosition);
    const handleResizeOrScroll = () => updateMoreMenuPosition();
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (moreMenuButtonRef.current?.contains(target) || moreMenuPanelRef.current?.contains(target)) {
        return;
      }
      setMoreMenuOpen(false);
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [moreMenuOpen]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    emitChatMessage(chatInput);
    setChatInput('');
  };

  const getActionText = (action: 'create' | 'update' | 'delete' | 'restore') => {
    switch (action) {
      case 'create': return '노드를 생성했습니다.';
      case 'update': return '노드를 수정했습니다.';
      case 'delete': return '노드를 삭제했습니다.';
      case 'restore': return '노드를 복구했습니다.';
      default: return '노드를 수정했습니다.';
    }
  };

  // 노드 포커싱/화면이동
  const handleFocusNode = (node: any) => {
    if (node && node.position) {
      setCenter(node.position.x + 160, node.position.y + 100, { zoom: 1.1, duration: 800 });
    }
  };

  // 상세 모달 에디터 타겟 노드 정보 조회
  const editingNode = useMemo(() => {
    return nodes.find(n => n.id === activeEditingNodeId);
  }, [nodes, activeEditingNodeId]);

  const handleModalTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeEditingNodeId) {
      updateNodeData(activeEditingNodeId, { title: e.target.value });
    }
  };

  const handleModalContentChange = (val?: string) => {
    if (activeEditingNodeId) {
      updateNodeData(activeEditingNodeId, { content: val || '' });
    }
  };

  const handleModalCategoryChange = (cat: 'idea' | 'document' | 'decision' | 'todo' | 'data') => {
    if (activeEditingNodeId) {
      updateNodeData(activeEditingNodeId, { category: cat });
    }
  };

  const handleModalClose = () => {
    if (activeEditingNodeId) {
      unlockNode(activeEditingNodeId);
      emitNodeHistoryAction(activeEditingNodeId, 'update');
      setActiveEditingNodeId(null);
      setIsModalChatOpen(false);
    }
  };

  const handleModalDelete = () => {
    if (activeEditingNodeId) {
      unlockNode(activeEditingNodeId);
      const success = softDeleteNode(activeEditingNodeId);
      if (success) {
        emitNodeHistoryAction(activeEditingNodeId, 'delete');
      }
      setActiveEditingNodeId(null);
      setIsModalChatOpen(false);
    }
  };

  // 노드 일괄 소프트 삭제
  const handleBulkDelete = () => {
    if (selectedNodeIds.size === 0) return;
    const confirmDelete = window.confirm(`선택한 ${selectedNodeIds.size}개의 노드를 삭제하시겠습니까?\n삭제된 노드는 휴지통에서 복구할 수 있습니다.`);
    if (!confirmDelete) return;
    selectedNodeIds.forEach(id => {
      // confirm 없이 직접 소프트삭제 처리 (confirm은 일괄 confirm으로 대체)
      useCanvasStore.setState(state => ({
        nodes: state.nodes.map(n =>
          n.id === id ? { ...n, data: { ...n.data, deletedAt: new Date().toISOString() } } : n
        )
      }));
      emitNodeHistoryAction(id, 'delete');
    });
    if (currentProject) {
      useCanvasStore.getState().triggerAutoSave(currentProject.id);
    }
    showToast(`${selectedNodeIds.size}개 노드가 휴지통으로 이동되었습니다.`, 'info');
    setSelectedNodeIds(new Set());
    setIsSelectMode(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#f4f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#00875a] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-gray-500">캔버스 레이아웃 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative w-full h-full text-gray-900 bg-[#f4f5f7]" onPointerMove={handlePointerMove}>

      {/* 이미지 4 스타일 헤더 툴바 (z-level3) */}
      <header className="h-16 border-b border-gray-200/80 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between relative z-level3 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => selectProject(null)}
            title="대시보드로 돌아가기"
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* 프로젝트 선택 및 노드 개수 드롭다운 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 shadow-sm text-sm">
            <span className="font-bold text-gray-800">{currentProject?.name}</span>
            <span className="text-xs font-semibold text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-full">
              노드 {activeNodes.length}개
            </span>
          </div>

          {/* 참여자 표시 (초성 아바타) */}
          <div className="flex items-center -space-x-2 ml-2">
            {activeParticipants.map((p) => {
              const firstChar = p.nickname.charAt(0);
              const hash = p.email.charCodeAt(0) || 0;
              return (
                <div
                  key={p.email}
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm cursor-default transition-all hover:scale-105"
                  style={{ backgroundColor: `hsl(${(hash * 37) % 360}, 65%, 45%)` }}
                  title={`${p.nickname}${p.isMe ? ' (나)' : ''} (${p.email})`}
                >
                  {firstChar}
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 조작계 */}
        <div className="flex items-center gap-2">
          {/* 실시간 검색창 */}
          <div className="relative w-48 md:w-60">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="노드/내용 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#00875a] focus:ring-1 focus:ring-[#00875a]/10 placeholder-gray-400 transition-all"
            />
          </div>

          <span className="w-px h-6 bg-gray-200 mx-1" />

          {/* 히스토리 토글 */}
          <button
            onClick={() => {
              setIsRightPanelOpen(true);
              setRightPanelTab('history');
            }}
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm"
            title="변경 히스토리"
          >
            <History className="w-4 h-4" />
          </button>

          {/* 휴지통 토글 */}
          <button
            onClick={() => {
              setIsLeftPanelOpen(true);
              // 왼쪽 패널 열어서 하단 휴지통 강조
            }}
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm relative"
            title="휴지통"
          >
            <Trash2 className="w-4 h-4" />
            {deletedNodes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center">
                {deletedNodes.length}
              </span>
            )}
          </button>

          {/* 저장 버튼 */}
          <button
            onClick={handleManualSave}
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-[#00875a] transition-colors shadow-sm"
            title="수동 저장"
          >
            <Save className="w-4 h-4" />
          </button>

          {/* 더보기 메뉴 */}
          <div className="relative">
            <button
              ref={moreMenuButtonRef}
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors shadow-sm"
              title="더보기"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          {moreMenuOpen && createPortal(
            <div
              ref={moreMenuPanelRef}
              style={moreMenuStyle}
              className="w-40 max-h-[calc(100vh-96px)] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 text-left"
            >
              <button
                onClick={() => {
                  setNewNickname(user?.nickname || '');
                  setIsProfileEditOpen(true);
                  setMoreMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-bold"
              >
                <Settings className="w-4 h-4" />
                <span>프로필 수정</span>
              </button>
              <button
                onClick={() => {
                  handleExportZip();
                  setMoreMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>ZIP 내보내기</span>
              </button>
              <button
                onClick={() => {
                  fitView({ duration: 500 });
                  setMoreMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Maximize className="w-4 h-4" />
                <span>화면 채우기</span>
              </button>
            </div>,
            document.body
          )}
        </div>
      </header>

      {/* 메인 캔버스 뷰포트 영역 */}
      <div className="flex-1 flex relative w-full h-full overflow-hidden">

        {/* 좌측 패널 (아코디언 형태) */}
        <div
          className={`h-full bg-white border-r border-gray-200 flex transition-all duration-300 relative z-level2 shadow-md ${isLeftPanelOpen ? 'w-[280px]' : 'w-[64px]'
            }`}
        >
          {isLeftPanelOpen ? (
            // 펼쳐진 상태
            <div className="flex-1 flex flex-col h-full p-4 justify-between">
              <div className="flex flex-col gap-4 overflow-hidden flex-1">
                {/* 상단 헤더 */}
                <div className="flex items-center justify-between border-b border-gray-150 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6.5 h-6.5 rounded-md bg-[#00875a] flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
                      이음
                    </div>
                    <span className="font-extrabold text-sm text-gray-800">이음</span>
                  </div>
                  <button
                    onClick={() => setIsLeftPanelOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* 노드 추가 액션 */}
                <button
                  onClick={() => handleAddNode('idea')}
                  className="w-full py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>새 노드 추가</span>
                </button>

                {/* 노드 리스트 목록 */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pr-1">
                  {/* 노드 목록 헤더 */}
                  <div className="flex items-center justify-between mt-2 mb-1">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                      노드 목록 {activeNodes.length > 0 && `(${activeNodes.length})`}
                    </span>
                    {activeNodes.length > 0 && (
                      <button
                        onClick={() => {
                          setIsSelectMode(v => !v);
                          setSelectedNodeIds(new Set());
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                          isSelectMode
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-200'
                        }`}
                      >
                        {isSelectMode ? '취소' : '선택'}
                      </button>
                    )}
                  </div>

                  {/* 선택 모드 일괄 액션 바 */}
                  {isSelectMode && (
                    <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                      <button
                        onClick={() => {
                          if (selectedNodeIds.size === activeNodes.length) {
                            setSelectedNodeIds(new Set());
                          } else {
                            setSelectedNodeIds(new Set(activeNodes.map(n => n.id)));
                          }
                        }}
                        className="text-[10px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {selectedNodeIds.size === activeNodes.length ? '전체해제' : '전체선택'}
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        disabled={selectedNodeIds.size === 0}
                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{selectedNodeIds.size > 0 ? `${selectedNodeIds.size}개 삭제` : '삭제'}</span>
                      </button>
                    </div>
                  )}

                  {activeNodes.length === 0 ? (
                    <span className="text-xs text-gray-400 italic block py-4 text-center">
                      활성화된 노드가 없습니다.
                    </span>
                  ) : (
                    activeNodes.map((n, idx) => {
                      const catColors: Record<string, string> = {
                        idea: 'bg-[#d97706]',
                        document: 'bg-[#2563eb]',
                        decision: 'bg-[#9333ea]',
                        todo: 'bg-[#16a34a]',
                        data: 'bg-[#db2777]'
                      };
                      const isChecked = selectedNodeIds.has(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (isSelectMode) {
                              // 선택 모드: 체크박스 토글
                              setSelectedNodeIds(prev => {
                                const next = new Set(prev);
                                if (next.has(n.id)) next.delete(n.id);
                                else next.add(n.id);
                                return next;
                              });
                            } else {
                              handleFocusNode(n);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all group cursor-pointer ${
                            isChecked
                              ? 'bg-rose-50 border-rose-200'
                              : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* 선택 모드 체크박스 */}
                            {isSelectMode && (
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isChecked ? 'bg-rose-500 border-rose-500' : 'border-gray-300 bg-white'
                              }`}>
                                {isChecked && (
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <span className={`w-2 h-2 rounded-full shrink-0 ${catColors[n.data.category || 'idea']}`} />
                            <span className="text-xs font-bold text-gray-700 truncate group-hover:text-gray-900">
                              {n.data.title || '제목 없음'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-extrabold bg-gray-200/50 px-1.5 py-0.5 rounded-md shrink-0">
                            n{idx + 1}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 하단 정보 영역 */}
              <div className="border-t border-gray-150 pt-3 flex flex-col gap-2">
                <p className="text-[10px] text-gray-400 leading-normal font-semibold">
                  * 드래그로 노드를 옮기고, 더블클릭으로 편집, 엣지 더블클릭으로 연결선이 삭제됩니다.
                </p>
              </div>
            </div>
          ) : (
            // 접힌 상태
            <div className="flex-1 flex flex-col items-center justify-between py-4 h-full">
              <div className="flex flex-col items-center gap-5 w-full">
                {/* 로고 */}
                <div
                  onClick={() => setIsLeftPanelOpen(true)}
                  className="w-8 h-8 rounded-lg bg-[#00875a] flex items-center justify-center font-bold text-white text-[11px] cursor-pointer shadow-md hover:scale-105 transition-transform"
                >
                  이음
                </div>
                {/* 아코디언 펼치기 */}
                <button
                  onClick={() => setIsLeftPanelOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  title="사이드바 펼치기"
                >
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
                <span className="w-8 h-px bg-gray-200" />
                {/* 플러스 신규생성 버튼 */}
                <button
                  onClick={() => handleAddNode('idea')}
                  className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 transition-all shadow-sm"
                  title="새 노드 추가"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* 6종 카테고리 컬러 칩 단축생성 */}
                <div className="flex flex-col gap-2.5 mt-2">
                  <button onClick={() => handleAddNode('idea')} className="w-4 h-4 rounded-full bg-[#d97706] hover:scale-110 transition-transform shadow-sm" title="💡 아이디어 생성" />
                  <button onClick={() => handleAddNode('document')} className="w-4 h-4 rounded-full bg-[#2563eb] hover:scale-110 transition-transform shadow-sm" title="📄 문서 생성" />
                  <button onClick={() => handleAddNode('decision')} className="w-4 h-4 rounded-full bg-[#9333ea] hover:scale-110 transition-transform shadow-sm" title="🔑 결정 생성" />
                  <button onClick={() => handleAddNode('todo')} className="w-4 h-4 rounded-full bg-[#16a34a] hover:scale-110 transition-transform shadow-sm" title="🟢 할일 생성" />
                  <button onClick={() => handleAddNode('data')} className="w-4 h-4 rounded-full bg-[#db2777] hover:scale-110 transition-transform shadow-sm" title="📦 데이터 생성" />
                </div>
              </div>

            </div>
          )}
        </div>

        {/* React Flow 캔버스 본체 영역 */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={activeNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            nodeTypes={nodeTypes}
            onViewportChange={(viewport) => setCurrentZoom(viewport.zoom)}
            fitView
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#cbd5e1" gap={24} size={1} />
            <Controls showInteractive={false} position="bottom-left" className="!hidden" />
          </ReactFlow>

          {/* 실시간 동기화 상태 뱃지 */}
          <div className="absolute top-4 right-4 z-level3 flex items-center gap-2 text-[10px] font-semibold">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/95 border border-gray-200 rounded-lg shadow-sm">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-gray-500">{isOnline ? '협업 동기화' : '로컬 모드'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/95 border border-gray-200 rounded-lg shadow-sm text-gray-500">
              <span className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>{isSaving ? '저장 중' : '저장 완료'}</span>
            </div>
          </div>

          {/* 하단 중앙: 임시 저장소 복원 드래프트 바 */}
          {deletedNodes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-level3 px-4 py-2.5 bg-white/95 border border-gray-200/90 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-gray-700">임시 저장소 · {deletedNodes.length}</span>
              </div>
              <span className="w-px h-4 bg-gray-200" />
              <span className="text-xs text-gray-600 max-w-[150px] truncate font-semibold">
                {deletedNodes[0].data.title}
              </span>
              <button
                onClick={() => handleRestoreNodeClick(deletedNodes[0].id)}
                className="px-2.5 py-1 bg-[#172b4d] hover:bg-[#091e42] text-white text-[10px] font-bold rounded-lg transition-colors shadow-sm"
              >
                복원
              </button>
            </div>
          )}

          {/* 하단 좌측: 휴지통 버튼 */}
          <div className="absolute bottom-4 left-4 z-level3 flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/95 border border-gray-200 rounded-2xl p-1.5 shadow-lg">
              <button
                onClick={() => setIsNodeTrashOpen(true)}
                className="px-2.5 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-[10px] font-bold text-gray-600 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                <span>휴지통 {deletedNodes.length}</span>
              </button>
            </div>
          </div>

          {/* 하단 우측: 세로형 줌 컨트롤 */}
          <div className="absolute bottom-4 right-4 z-level3 flex flex-col items-end gap-3">
            <div className="flex flex-col items-center bg-white border border-gray-200 rounded-2xl shadow-xl p-1 gap-1">
              <div className="text-[10px] font-extrabold text-gray-500 py-1.5 px-2 border-b border-gray-100 min-w-[45px] text-center">
                {Math.round(currentZoom * 100)}%
              </div>
              <button
                onClick={() => zoomIn({ duration: 300 })}
                className="p-2 hover:bg-gray-50 text-gray-600 rounded-xl transition-colors"
                title="확대"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => zoomOut({ duration: 300 })}
                className="p-2 hover:bg-gray-50 text-gray-600 rounded-xl transition-colors"
                title="축소"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => zoomTo(1, { duration: 300 })}
                className="p-2 hover:bg-gray-50 text-gray-600 rounded-xl transition-colors"
                title="100% 리셋"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {/* 멀티커서 fixed 오버레이: flowToScreenPosition() 결과가 뷰포트 좌표이므로 fixed로 배치해야 정확 */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 35 }}>
          {Object.entries(cursors).map(([socketId, cursor]) => {
            if (cursor.email === user?.email) return null;

            // 수신된 캔버스 좌표 → 현재 뷰포트 기준 화면 좌표로 역변환
            let screenPos = { x: cursor.x, y: cursor.y };
            try {
              screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y });
            } catch (_) {
              // 변환 실패 시 원본 사용
            }

            const hash = cursor.email.split('@')[0].charCodeAt(0) || 0;
            const colors = [
              '#db2777', '#f43f5e', '#a855f7', '#3b82f6',
              '#06b6d4', '#10b981', '#f59e0b', '#16a34a'
            ];
            const color = colors[hash % colors.length];

            return (
              <div
                key={socketId}
                className="absolute transition-all duration-75 ease-out"
                style={{
                  left: screenPos.x,
                  top: screenPos.y,
                  transform: 'translate(-2px, -2px)'
                }}
              >
                <svg
                  className="w-5 h-5 drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 3V21L9 15L13 23L16 21L12 13L20 13L3 3Z"
                    fill={color}
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <div
                  className="ml-4 mt-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-md border"
                  style={{
                    backgroundColor: color,
                    borderColor: `${color}cc`
                  }}
                >
                  {cursor.nickname || cursor.email.split('@')[0]}
                </div>
              </div>
            );
          })}
        </div>

        {/* 우측 패널 (아코디언 형태) */}
        <div
          className={`h-full bg-white border-l border-gray-200 flex transition-all duration-300 relative z-level2 shadow-md ${isRightPanelOpen ? 'w-[320px]' : 'w-[64px]'
            }`}
        >
          {isRightPanelOpen ? (
            // 펼쳐진 상태
            <div className="flex-1 flex flex-col h-full relative">
              {/* 사이드바 헤더 및 탭 셀렉터 */}
              <div className="px-4 pt-4 pb-2 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-sm tracking-tight text-gray-900 uppercase">
                    {rightPanelTab === 'chat' ? '팀 채팅' : '히스토리'}
                  </h3>
                  <button
                    onClick={() => setIsRightPanelOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 탭 버튼 그룹 */}
                <div className="flex bg-gray-50 p-0.5 rounded-xl border border-gray-200">
                  <button
                    onClick={() => setRightPanelTab('chat')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${rightPanelTab === 'chat'
                      ? 'bg-white text-[#172b4d] shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>팀 채팅</span>
                    {unreadChatCount > 0 && (
                      <span className="absolute right-2 top-1.5 w-4 h-4 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center">
                        {unreadChatCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setRightPanelTab('history')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${rightPanelTab === 'history'
                      ? 'bg-white text-[#172b4d] shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                      }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>히스토리</span>
                  </button>
                </div>
              </div>

              {/* 탭 1: 채팅 메시지 영역 */}
              {rightPanelTab === 'chat' && (
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-gray-50/30">
                  {/* 접속 중인 멤버 현황 */}
                  <div className="px-4 py-2 border-b border-gray-150 flex items-center gap-2 bg-white text-xs text-gray-500 font-bold">
                    <div className="flex items-center -space-x-1">
                      {activeParticipants.slice(0, 5).map((p) => {
                        const firstChar = p.nickname.charAt(0);
                        const hash = p.email.charCodeAt(0) || 0;
                        const bgColors = ['bg-[#10b981]', 'bg-[#3b82f6]', 'bg-[#a855f7]', 'bg-[#ec4899]', 'bg-[#f59e0b]', 'bg-[#14b8a6]'];
                        const bgClass = bgColors[hash % bgColors.length];
                        return (
                          <div
                            key={p.email}
                            className={`w-5.5 h-5.5 rounded-full ${bgClass} flex items-center justify-center text-[8px] font-extrabold text-white border border-white`}
                            title={p.nickname}
                          >
                            {firstChar}
                          </div>
                        );
                      })}
                      {activeParticipants.length > 5 && (
                        <div className="w-5.5 h-5.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 border border-white">
                          +{activeParticipants.length - 5}
                        </div>
                      )}
                    </div>
                    <span>{activeParticipants.length}명 접속 중</span>
                  </div>

                  {/* 채팅 로그 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-gray-400 font-semibold italic text-center">
                        대화 기록이 없습니다.<br />팀원들과 아이디어를 나누어보세요!
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.email === user?.email;
                        const senderName = msg.nickname || msg.email.split('@')[0];
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] text-gray-400 mb-1 font-semibold">
                              {senderName}
                            </span>
                            <div className={`px-3 py-2 rounded-2xl text-xs max-w-[90%] break-words font-medium shadow-sm ${isMe
                              ? 'bg-[#00875a] text-white rounded-tr-none'
                              : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none'
                              }`}>
                              {msg.content}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* 대화 입력 폼 */}
                  <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-200 bg-white flex gap-2">
                    <input
                      ref={chatInputRef}
                      type="text"
                      required
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="메시지 보내기..."
                      className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#00875a] transition-all font-semibold"
                    />
                    <button
                      type="submit"
                      className="p-2 rounded-xl bg-[#00875a] hover:bg-[#006644] text-white transition-colors shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* 탭 2: 히스토리 로그 영역 */}
              {rightPanelTab === 'history' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-gray-50/30">
                  {histories.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400 font-semibold italic text-center">
                      변경 이력이 존재하지 않습니다.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {histories.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            const targetNode = nodes.find(n => n.id === item.nodeId);
                            if (targetNode) {
                              handleFocusNode(targetNode);
                            } else {
                              showToast('해당 노드가 없거나 삭제된 상태입니다.', 'info');
                            }
                          }}
                          className="p-3 rounded-xl bg-white border border-gray-150 flex gap-2.5 items-start text-left shadow-sm hover:shadow transition-shadow cursor-pointer hover:border-gray-300"
                        >
                          <Clock className="w-4 h-4 text-[#00875a] shrink-0 mt-0.5" />
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs text-gray-800 font-semibold break-all leading-normal">
                              <span className="text-[#00875a] font-extrabold pr-1">
                                {item.userEmail.split('@')[0]}
                              </span>
                              <span>님이 </span>
                              <span className="text-gray-900 font-bold block truncate w-36">
                                {nodes.find(n => n.id === item.nodeId)?.data.title || item.nodeId.substring(0, 10)}
                              </span>
                              <span>{getActionText(item.action)}</span>
                            </p>
                            <span className="text-[9px] text-gray-400 font-semibold block">
                              {new Date(item.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // 접힌 상태
            <div className="flex-1 flex flex-col items-center justify-between py-4 h-full">
              <div className="flex flex-col items-center gap-5 w-full">
                {/* 아코디언 펼치기 */}
                <button
                  onClick={() => setIsRightPanelOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                  title="사이드바 펼치기"
                >
                  <ChevronLeft className="w-4.5 h-4.5" />
                </button>
                <span className="w-8 h-px bg-gray-200" />

                {/* 채팅 아이콘 단축 */}
                <button
                  onClick={() => {
                    setRightPanelTab('chat');
                    setIsRightPanelOpen(true);
                  }}
                  className={`p-2 rounded-xl transition-all relative ${rightPanelTab === 'chat' ? 'bg-gray-100 text-[#00875a]' : 'text-gray-400 hover:text-gray-600'}`}
                  title="팀 채팅"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                      {unreadChatCount}
                    </span>
                  )}
                </button>

                {/* 히스토리 아이콘 단축 */}
                <button
                  onClick={() => {
                    setRightPanelTab('history');
                    setIsRightPanelOpen(true);
                  }}
                  className={`p-2 rounded-xl transition-all ${rightPanelTab === 'history' ? 'bg-gray-100 text-[#00875a]' : 'text-gray-400 hover:text-gray-600'}`}
                  title="변경 이력"
                >
                  <History className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* 접속 중인 멤버 아바타 */}
              <div className="flex flex-col items-center gap-1">
                {activeParticipants.slice(0, 3).map((p) => {
                  const firstChar = p.nickname.charAt(0);
                  const hash = p.email.charCodeAt(0) || 0;
                  const bgColors = ['bg-[#10b981]', 'bg-[#3b82f6]', 'bg-[#a855f7]', 'bg-[#ec4899]', 'bg-[#f59e0b]', 'bg-[#14b8a6]'];
                  const bgClass = bgColors[hash % bgColors.length];
                  return (
                    <div
                      key={p.email}
                      className={`w-5.5 h-5.5 rounded-full ${bgClass} flex items-center justify-center text-[8px] font-extrabold text-white border border-white`}
                      title={p.nickname}
                    >
                      {firstChar}
                    </div>
                  );
                })}
                {activeParticipants.length > 3 && (
                  <div className="w-5.5 h-5.5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 border border-white" title="추가 접속자">
                    +{activeParticipants.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 이미지 1 & 2 스타일: 마크다운 상세 에디터 모달 (z-level4) */}
      {activeEditingNodeId && editingNode && (
        <div className="fixed inset-0 z-level4 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[90vw] h-[85vh] bg-[#f8f9fa] border border-gray-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">

            {/* 모달 상단 헤더 */}
            <div className="h-16 border-b border-gray-200 bg-white/95 px-6 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00875a]" />
                <input
                  type="text"
                  value={editingNode.data.title}
                  onChange={handleModalTitleChange}
                  className="bg-transparent border-none outline-none font-extrabold text-md text-gray-900 focus:ring-1 focus:ring-gray-200 rounded px-2 py-1 min-w-[200px]"
                />

                {/* 커스텀 카테고리 셀렉터 팝오버 뱃지 */}
                <div className="relative">
                  <button
                    onClick={() => setCategoryMenuOpen(!categoryMenuOpen)}
                    className="text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span>{
                      editingNode.data.category === 'idea' ? '💡 아이디어' :
                        editingNode.data.category === 'document' ? '📄 문서' :
                          editingNode.data.category === 'decision' ? '🔑 결정' :
                            editingNode.data.category === 'todo' ? '🟢 할일' :
                              editingNode.data.category === 'data' ? '📦 데이터' : '💡 아이디어'
                    }</span>
                  </button>
                  {categoryMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-32 bg-white border border-gray-250 rounded-xl shadow-xl py-1.5 z-level5 text-left">
                      {(['idea', 'document', 'decision', 'todo', 'data'] as const).map((cat) => {
                        const labels = { idea: '💡 아이디어', document: '📄 문서', decision: '🔑 결정', todo: '🟢 할일', data: '📦 데이터' };
                        return (
                          <button
                            key={cat}
                            onClick={() => {
                              handleModalCategoryChange(cat);
                              setCategoryMenuOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 font-bold block"
                          >
                            {labels[cat]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleModalClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title="닫기"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 모달 중앙: 좌우 분할식 에디터 본문 (좌: 소스, 우: 미리보기) */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* 좌측: 소스 코드 에디터 */}
              <div className="flex-1 flex flex-col h-full bg-white border-r border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-400 tracking-wider">
                  MARKDOWN
                </div>
                <div className="flex-1 overflow-auto p-4 w-full h-full">
                  <MDEditor
                    value={editingNode.data.content}
                    onChange={handleModalContentChange}
                    preview="edit"
                    extraCommands={[]}
                    height="100%"
                    className="!border-none !shadow-none !h-full w-full"
                  />
                </div>
              </div>

              {/* 우측: 실시간 마크다운 미리보기 */}
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-400 tracking-wider">
                  미리보기
                </div>
                <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-800 prose max-w-none break-all select-text">
                  <MDEditor.Markdown
                    source={editingNode.data.content || '*내용이 없습니다.*'}
                    className="!bg-white !text-sm !text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* 모달 하단 액션바 */}
            <div className="h-16 border-t border-gray-200 bg-white/95 px-6 flex items-center justify-between shadow-sm">
              <button
                onClick={handleModalDelete}
                className="px-4 py-2 rounded-xl bg-transparent border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>노드 삭제</span>
              </button>

              <button
                onClick={handleModalClose}
                className="px-6 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-md"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 모달: 삭제된 노드 휴지통 팝업 */}
      {isNodeTrashOpen && (
        <div className="fixed inset-0 z-level4 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-3xl border border-gray-200 bg-white shadow-2xl relative max-h-[70vh] flex flex-col">
            <button
              onClick={() => setIsNodeTrashOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-150 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2 border-b border-gray-150 pb-3 text-gray-800">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <span>노드 휴지통</span>
            </h3>

            <div className="flex-1 overflow-y-auto min-h-[250px] py-2">
              {deletedNodes.length === 0 ? (
                <div className="text-center text-gray-400 py-16 font-semibold flex flex-col items-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-gray-300" />
                  <span>삭제된 노드가 없습니다.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedNodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 flex flex-col gap-2 cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => setPreviewNodeId(previewNodeId === node.id ? null : node.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="max-w-[70%] min-w-0">
                          <h4 className="font-bold text-gray-800 truncate">{node.data.title}</h4>
                          <p className="text-[10px] text-gray-400 mt-1 truncate italic">
                            {node.data.content}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreNodeClick(node.id);
                          }}
                          className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 text-[#00875a] text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>복구</span>
                        </button>
                      </div>

                      {previewNodeId === node.id && (
                        <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl max-h-40 overflow-y-auto text-xs text-gray-700 prose max-w-none select-text" onClick={(e) => e.stopPropagation()}>
                          <MDEditor.Markdown
                            source={node.data.content || '*내용이 없습니다.*'}
                            className="!bg-white !text-xs !text-gray-700"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모달: 프로필 수정 팝업 */}
      {isProfileEditOpen && (
        <div className="fixed inset-0 z-level4 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-3xl border border-gray-200 bg-white shadow-2xl relative">
            <button
              onClick={() => setIsProfileEditOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-150 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2 border-b border-gray-150 pb-3 text-gray-800">
              <Settings className="w-5 h-5 text-[#00875a]" />
              <span>프로필 수정</span>
            </h3>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-semibold uppercase">
                  이메일
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 font-semibold cursor-not-allowed text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-semibold uppercase">
                  닉네임
                </label>
                <input
                  ref={profileInputRef}
                  type="text"
                  required
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="새로운 닉네임을 입력하세요 (최소 2자)"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00875a] focus:ring-2 focus:ring-[#00875a]/10 transition-all font-semibold text-xs"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-750 font-bold transition-colors text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00875a] text-white font-bold hover:bg-[#006644] transition-all shadow-md text-xs"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const CanvasWorkspace: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};


