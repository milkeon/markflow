// frontend/src/components/MarkdownNode.tsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCanvasStore, type MarkdownNodeData } from '../store/canvasStore.js';
import { useAuthStore } from '../store/authStore.js';
import { ChevronUp, ChevronDown, Trash2, Lock, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MarkdownNodeProps {
  id: string;
  data: MarkdownNodeData & {
    openEditor?: (id: string) => void;
  };
  selected?: boolean;
}

// 카테고리별 디자인 스타일 정의
const CATEGORY_STYLES = {
  idea: {
    bg: 'bg-[#fffbeb]',
    border: 'border-[#fde68a]',
    badgeBg: 'bg-[#fef3c7]',
    badgeText: 'text-[#d97706]',
    label: '💡 아이디어',
    accentColor: '#d97706'
  },
  document: {
    bg: 'bg-[#eff6ff]',
    border: 'border-[#bfdbfe]',
    badgeBg: 'bg-[#dbeafe]',
    badgeText: 'text-[#2563eb]',
    label: '📄 문서',
    accentColor: '#2563eb'
  },
  decision: {
    bg: 'bg-[#faf5ff]',
    border: 'border-[#e9d5ff]',
    badgeBg: 'bg-[#f3e8ff]',
    badgeText: 'text-[#9333ea]',
    label: '🔑 결정',
    accentColor: '#9333ea'
  },
  todo: {
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    badgeBg: 'bg-[#dcfce7]',
    badgeText: 'text-[#16a34a]',
    label: '🟢 할일',
    accentColor: '#16a34a'
  },
  data: {
    bg: 'bg-[#fdf2f8]',
    border: 'border-[#fbcfe8]',
    badgeBg: 'bg-[#fce7f3]',
    badgeText: 'text-[#db2777]',
    label: '📦 데이터',
    accentColor: '#db2777'
  }
};

export const MarkdownNode: React.FC<MarkdownNodeProps> = ({ id, data, selected }) => {
  const { updateNodeData, softDeleteNode } = useCanvasStore();
  const { user } = useAuthStore();

  const isLocked = !!(data.editingUser && data.editingUser !== user?.email);
  const category = data.category || 'idea';
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.idea;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { isCollapsed: !data.isCollapsed });
    data.emitNodeHistoryAction?.(id, 'update');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { title: e.target.value });
  };

  const handleTitleBlur = () => {
    data.emitNodeHistoryAction?.(id, 'update');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = softDeleteNode(id);
    if (success) {
      data.emitNodeHistoryAction?.(id, 'delete');
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked && data.openEditor) {
      data.openEditor(id);
    }
  };

  return (
    <div 
      onDoubleClick={handleDoubleClick}
      className={`rounded-2xl border shadow-lg transition-all text-left w-[320px] relative overflow-hidden bg-white ${
        selected 
          ? 'ring-2 shadow-xl' 
          : 'border-gray-200 shadow-sm'
      }`}
      style={{
        borderColor: selected ? style.accentColor : undefined,
        boxShadow: selected ? `0 10px 25px -5px ${style.accentColor}25` : undefined
      }}
    >
      
      {/* React Flow 연결 포트 핸들 - 상하좌우 부착 */}
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-gray-300 !w-3 !h-3 !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-gray-300 !w-3 !h-3 !border-white" />
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-gray-300 !w-3 !h-3 !border-white" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-gray-300 !w-3 !h-3 !border-white" />

      {/* 노드 헤더 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 handle react-flow__draghandle cursor-move select-none ${style.bg}`}>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 mr-2">
          {/* 카테고리 배지 */}
          <span className={`inline-self-start text-[10px] font-extrabold px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText} w-fit`}>
            {style.label}
          </span>
          <input
            type="text"
            value={data.title}
            disabled={isLocked}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="노드 제목"
            className="bg-transparent border-none outline-none font-bold text-sm text-gray-900 flex-1 focus:ring-1 focus:ring-gray-200 rounded px-1.5 py-0.5 nodrag"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 소프트 락 뱃지 */}
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-600 px-1.5 py-0.5 rounded-md">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="max-w-[60px] truncate">{data.editingUser?.split('@')[0]}</span>
            </span>
          )}

          {/* 접기/펼치기 */}
          <button 
            onClick={toggleCollapse}
            className="p-1 rounded hover:bg-gray-150 text-gray-400 hover:text-gray-700 transition-colors nodrag"
            title={data.isCollapsed ? '펼치기' : '접기'}
          >
            {data.isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* 노드 삭제 */}
          {!isLocked && (
            <button 
              onClick={handleDelete}
              className="p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors nodrag"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 노드 본문 영역 */}
      <div className="p-4 bg-white">
        {data.isCollapsed ? (
          <div 
            onClick={toggleCollapse}
            className="text-xs text-gray-400 italic truncate cursor-pointer hover:text-gray-600 select-none py-1"
          >
            {data.content.trim().split('\n')[0] || '내용이 없는 빈 노드입니다.'}
          </div>
        ) : (
          <div className="w-full relative space-y-3">
            <div 
              className="max-h-[120px] overflow-y-auto rounded-xl border border-gray-100 p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-text nodrag"
              title="더블클릭하여 상세 에디터 열기"
            >
              <div className="text-xs text-gray-700 prose max-w-none break-all line-clamp-4 select-text">
                <ReactMarkdown>{data.content || '*내용이 없습니다.*'}</ReactMarkdown>
              </div>
            </div>

            {/* 에디터 열기 액션 버튼 */}
            {!isLocked && data.openEditor && (
              <button
                onClick={() => data.openEditor?.(id)}
                className="w-full py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-100 hover:text-gray-800 transition-colors flex items-center justify-center gap-1.5 nodrag"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>상세 보기 (에디터 열기)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
