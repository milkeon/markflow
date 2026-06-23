// frontend/src/components/CanvasWorkspace.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { useCanvasStore } from '../store/canvasStore.js';
import { useProjectStore } from '../store/projectStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useCollaboration } from '../hooks/useCollaboration.js';
import { MarkdownNode } from './MarkdownNode.js';
import { Plus, Maximize, Save, Trash2, ArrowLeft, RotateCcw, AlertTriangle, MessageSquare, Send, X, Network, Download, History, Clock } from 'lucide-react';
import JSZip from 'jszip';

import '@xyflow/react/dist/style.css';

// React Flow 커스텀 노드 타입 매핑 등록
const nodeTypes = {
  markdown: MarkdownNode
};

const CanvasInner: React.FC = () => {
  const { 
    nodes, 
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
    restoreNode
  } = useCanvasStore();

  const { currentProject, selectProject, showToast } = useProjectStore();
  const { user } = useAuthStore();
  const { screenToFlowPosition, fitView } = useReactFlow();

  // 1. 실시간 협업 훅 호출 (히스토리 관련 추가)
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

  const [isNodeTrashOpen, setIsNodeTrashOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'history'>('chat'); // 사이드바 내부 탭 관리
  const [chatInput, setChatInput] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // 현재 프로젝트 캔버스 로딩
  useEffect(() => {
    if (currentProject) {
      loadCanvas(currentProject.id);
    }
  }, [currentProject]);

  // 노드/엣지 로컬 변경 시 실시간 브로드캐스트 전송
  useEffect(() => {
    if (nodes.length > 0) {
      emitNodeChange(nodes);
    }
  }, [nodes, emitNodeChange]);

  useEffect(() => {
    if (edges.length > 0) {
      emitEdgeChange(edges);
    }
  }, [edges, emitEdgeChange]);

  // 대화 목록 추가 시 최하단으로 자동 스크롤
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isSidebarOpen, sidebarTab]);

  // 채팅 패널 활성화 시 입력창 자동 포커스
  useEffect(() => {
    if (isSidebarOpen && sidebarTab === 'chat' && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isSidebarOpen, sidebarTab]);

  // 소프트 삭제되지 않은 활성 노드만 캔버스에 렌더링하도록 필터링
  const activeNodes = useMemo(() => {
    return nodes
      .filter(node => node.data.deletedAt === undefined)
      .map(node => ({
        ...node,
        data: {
          ...node.data,
          lockNode,
          unlockNode,
          emitNodeHistoryAction // 각 노드에 히스토리 발송 콜백 매핑
        }
      }));
  }, [nodes, lockNode, unlockNode, emitNodeHistoryAction]);

  // 소프트 삭제된 노드 목록 캐싱
  const deletedNodes = useMemo(() => {
    return getDeletedNodes();
  }, [nodes, getDeletedNodes]);

  const handleAddNode = () => {
    // 캔버스 중심부 근처에 노드 추가 및 아이디 획득
    const newId = addMarkdownNode(150, 150);
    if (newId) {
      // 1. 소켓 변경 로그(히스토리) 이벤트 발송
      emitNodeHistoryAction(newId, 'create');
      showToast('새 마크다운 노드가 생성되었습니다.', 'success');
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
      // 복구 성공 히스토리 로그 전송
      emitNodeHistoryAction(nodeId, 'restore');
    }
  };

  // 노드 마크다운 문서를 ZIP으로 다운로드하는 내보내기 기능 (jszip 연동)
  const handleExportZip = async () => {
    if (activeNodes.length === 0) {
      showToast('내보낼 마크다운 노드가 없습니다.', 'info');
      return;
    }

    const zip = new JSZip();

    activeNodes.forEach((node) => {
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
      const projName = currentProject ? currentProject.name.replace(/[\\/:*?"<>|]/g, '_') : 'markflow';
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

  if (isLoading) {
    return (
      <div className="flex-1 bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-dark-300">캔버스 레이아웃 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex relative w-full h-full" onPointerMove={handlePointerMove}>
      
      {/* 메인 캔버스 뷰포트 영역 */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* 캔버스 조작 툴바 (Floating Panel) */}
        <div className="absolute top-6 left-6 z-10 flex items-center gap-3 p-2 bg-dark-800/80 border border-dark-700/80 backdrop-blur-md rounded-2xl shadow-2xl">
          <button
            onClick={() => selectProject(null)}
            title="대시보드로 돌아가기"
            className="p-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center gap-1 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4 text-dark-300" />
            <span>목록</span>
          </button>

          <span className="w-px h-6 bg-dark-700" />

          <button
            onClick={handleAddNode}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-brand-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>노드 추가</span>
          </button>

          <button
            onClick={() => fitView({ duration: 500 })}
            title="한눈에 보기"
            className="p-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors"
          >
            <Maximize className="w-4 h-4 text-dark-200" />
          </button>

          <button
            onClick={handleManualSave}
            title="즉시 저장"
            className="p-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center gap-1.5 text-sm font-semibold text-dark-200"
          >
            <Save className="w-4 h-4" />
            <span>저장</span>
          </button>

          <button
            onClick={handleExportZip}
            title="마크다운 ZIP 내보내기"
            className="p-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center gap-1.5 text-sm font-semibold text-dark-200"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          <button
            onClick={() => setIsNodeTrashOpen(true)}
            className="p-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors relative"
            title="노드 휴지통"
          >
            <Trash2 className="w-4 h-4 text-dark-300" />
            {deletedNodes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-500 text-[10px] font-extrabold flex items-center justify-center text-white border border-dark-800">
                {deletedNodes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              if (isSidebarOpen) {
                setIsSidebarOpen(false);
              } else {
                setSidebarTab('chat');
                setIsSidebarOpen(true);
              }
            }}
            className={`p-2.5 rounded-xl border transition-colors relative ${
              isSidebarOpen && sidebarTab === 'chat'
                ? 'bg-brand-600 border-brand-500 text-white' 
                : 'bg-dark-900 border-dark-700 hover:bg-dark-700 text-dark-300'
            }`}
            title="실시간 채팅"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (isSidebarOpen) {
                setIsSidebarOpen(false);
              } else {
                setSidebarTab('history');
                setIsSidebarOpen(true);
              }
            }}
            className={`p-2.5 rounded-xl border transition-colors relative ${
              isSidebarOpen && sidebarTab === 'history'
                ? 'bg-brand-600 border-brand-500 text-white' 
                : 'bg-dark-900 border-dark-700 hover:bg-dark-700 text-dark-300'
            }`}
            title="변경 이력 (히스토리)"
          >
            <History className="w-4 h-4" />
          </button>
        </div>

        {/* 실시간 온라인 상태 및 오토세이브 상태 뱃지 (우상단) */}
        <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-800/80 border border-dark-700/80 backdrop-blur-md rounded-xl text-xs font-semibold">
            <Network className={`w-3.5 h-3.5 ${isOnline ? 'text-brand-400' : 'text-rose-400'}`} />
            <span className={isOnline ? 'text-brand-300' : 'text-rose-300'}>
              {isOnline ? '실시간 연결됨' : '오프라인 모드'}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-800/80 border border-dark-700/80 backdrop-blur-md rounded-xl text-xs font-semibold text-dark-300">
            <span className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span>{isSaving ? '자동 저장 중...' : '동기화됨'}</span>
          </div>
        </div>

        {/* React Flow 캔버스 본체 */}
        <div className="flex-1 w-full h-full">
          <ReactFlow
            nodes={activeNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#333333" gap={24} size={1} />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap zoomable pannable position="bottom-right" />

            {/* 실시간 마우스 멀티커서 렌더링 오버레이 */}
            <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
              {Object.entries(cursors).map(([socketId, cursor]) => {
                if (cursor.email === user?.email) return null;
                
                const hash = cursor.email.split('@')[0].charCodeAt(0) || 0;
                const colors = [
                  '#ec4899', '#f43f5e', '#a855f7', '#6366f1', 
                  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'
                ];
                const color = colors[hash % colors.length];

                return (
                  <div
                    key={socketId}
                    className="absolute transition-all duration-75 ease-out"
                    style={{
                      left: cursor.x,
                      top: cursor.y,
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
                      {cursor.email.split('@')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </ReactFlow>
        </div>
      </div>

      {/* 실시간 협업 우측 사이드바 패널 (채팅 및 히스토리 통합 탭) */}
      {isSidebarOpen && (
        <div className="w-[320px] bg-dark-800 border-l border-dark-700/80 h-full flex flex-col relative z-20 shadow-2xl">
          
          {/* 사이드바 헤더 및 탭 셀렉터 */}
          <div className="px-4 pt-4 pb-2 border-b border-dark-700/60">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-sm tracking-tight text-white uppercase">
                {sidebarTab === 'chat' ? '실시간 대화' : '노드 변경 로그'}
              </h3>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            {/* 탭 버튼 그룹 */}
            <div className="flex bg-dark-900 p-0.5 rounded-xl border border-dark-700">
              <button
                onClick={() => setSidebarTab('chat')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'chat'
                    ? 'bg-dark-800 text-white shadow-md'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>대화</span>
              </button>
              <button
                onClick={() => setSidebarTab('history')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'history'
                    ? 'bg-dark-800 text-white shadow-md'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>히스토리</span>
              </button>
            </div>
          </div>

          {/* 탭 1: 채팅 메시지 영역 */}
          {sidebarTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-dark-500 font-semibold italic text-center">
                    대화 기록이 없습니다.<br />팀원들과 아이디어를 나누어보세요!
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.email === user?.email;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-dark-400 mb-1 font-semibold">
                          {isMe ? '나' : msg.email.split('@')[0]}
                        </span>
                        <div className={`px-3 py-2 rounded-2xl text-xs max-w-[90%] break-words font-medium ${
                          isMe 
                            ? 'bg-brand-600 text-white rounded-tr-none' 
                            : 'bg-dark-900 text-dark-100 border border-dark-700 rounded-tl-none'
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
              <form onSubmit={handleChatSubmit} className="p-3 border-t border-dark-700 bg-dark-900/60 flex gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  required
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="메시지를 입력하세요"
                  className="flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 transition-all font-semibold"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* 탭 2: 노드 히스토리 변경 로그 영역 */}
          {sidebarTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {histories.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-dark-500 font-semibold italic text-center">
                  변경 이력이 존재하지 않습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {histories.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 rounded-xl bg-dark-900/60 border border-dark-700/60 flex gap-2.5 items-start text-left"
                    >
                      <Clock className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs text-white font-semibold break-all leading-normal">
                          <span className="text-brand-300 font-extrabold pr-1">
                            {item.userEmail.split('@')[0]}
                          </span>
                          <span>님이 </span>
                          <span className="text-dark-200 font-bold">{item.nodeId.substring(0, 10)}</span>
                          <span> {getActionText(item.action)}</span>
                        </p>
                        <span className="text-[10px] text-dark-400 font-medium block">
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
      )}

      {/* 모달: 삭제된 노드 휴지통 */}
      {isNodeTrashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-dark-700 bg-dark-800 shadow-2xl relative max-h-[70vh] flex flex-col">
            <button 
              onClick={() => setIsNodeTrashOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-dark-700 pb-3">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>노드 휴지통</span>
            </h3>

            <div className="flex-1 overflow-y-auto min-h-[250px] py-2">
              {deletedNodes.length === 0 ? (
                <div className="text-center text-dark-400 py-16 font-semibold flex flex-col items-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-dark-500" />
                  <span>삭제된 노드가 없습니다.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {deletedNodes.map((node) => (
                    <div 
                      key={node.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-dark-700 bg-dark-900/60"
                    >
                      <div className="max-w-[70%]">
                        <h4 className="font-bold text-white truncate">{node.data.title}</h4>
                        <p className="text-[10px] text-dark-400 mt-1 truncate italic">
                          {node.data.content}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          handleRestoreNodeClick(node.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-950/60 border border-brand-500/40 text-brand-300 text-xs font-bold hover:bg-brand-900/60 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>복구</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
