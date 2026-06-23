// frontend/src/components/MarkdownNode.tsx
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import MDEditor from '@uiw/react-md-editor';
import { useCanvasStore, type MarkdownNodeData } from '../store/canvasStore.js';
import { useAuthStore } from '../store/authStore.js';
import { ChevronUp, ChevronDown, Trash2, Lock, Eye } from 'lucide-react';

import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

interface MarkdownNodeProps {
  id: string;
  data: MarkdownNodeData;
  selected?: boolean;
}

export const MarkdownNode: React.FC<MarkdownNodeProps> = ({ id, data, selected }) => {
  const { updateNodeData, softDeleteNode } = useCanvasStore();
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);

  const isLocked = !!(data.editingUser && data.editingUser !== user?.email);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { isCollapsed: !data.isCollapsed });
    // 접기/펼치기도 상태 변경이므로 업데이트 이력 기록
    data.emitNodeHistoryAction?.(id, 'update');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { title: e.target.value });
  };

  // 제목 입력기 포커스 아웃 시 변경 이력 기록
  const handleTitleBlur = () => {
    data.emitNodeHistoryAction?.(id, 'update');
  };

  const handleContentChange = (val?: string) => {
    updateNodeData(id, { content: val || '' });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = softDeleteNode(id);
    if (success) {
      data.emitNodeHistoryAction?.(id, 'delete');
    }
  };

  return (
    <div className={`rounded-xl border shadow-2xl backdrop-blur-md transition-all text-left ${
      selected 
        ? 'border-brand-500 ring-2 ring-brand-500/35 shadow-brand-500/10' 
        : 'border-dark-700/80'
    } bg-dark-800/90 w-[350px] relative overflow-hidden nodrag`}>
      
      {/* React Flow 연결 포트 핸들 - 상하좌우 부착 */}
      <Handle type="target" position={Position.Top} className="!bg-dark-600 !w-3 !h-3 !border-dark-700" />
      <Handle type="source" position={Position.Bottom} className="!bg-dark-600 !w-3 !h-3 !border-dark-700" />
      <Handle type="target" position={Position.Left} className="!bg-dark-600 !w-3 !h-3 !border-dark-700" />
      <Handle type="source" position={Position.Right} className="!bg-dark-600 !w-3 !h-3 !border-dark-700" />

      {/* 노드 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-dark-900/60 border-b border-dark-700/60 handle cursor-move select-none">
        <input
          type="text"
          value={data.title}
          disabled={isLocked}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          className="bg-transparent border-none outline-none font-bold text-sm text-white flex-1 focus:ring-1 focus:ring-brand-500/30 rounded px-1.5 py-0.5"
        />

        <div className="flex items-center gap-1.5 ml-2">
          {/* 소프트 락 뱃지 */}
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-950/60 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded-md">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="max-w-[70px] truncate">{data.editingUser?.split('@')[0]} 편집중</span>
            </span>
          )}

          {/* 접기/펼치기 */}
          <button 
            onClick={toggleCollapse}
            className="p-1 rounded hover:bg-white/10 text-dark-300 hover:text-white transition-colors"
          >
            {data.isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* 노드 삭제 */}
          {!isLocked && (
            <button 
              onClick={handleDelete}
              className="p-1 rounded hover:bg-rose-900/20 text-dark-300 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 노드 본문 영역 */}
      <div className="p-3">
        {data.isCollapsed ? (
          <div 
            onClick={toggleCollapse}
            className="text-xs text-dark-300 italic truncate cursor-pointer hover:text-dark-200 select-none py-1"
          >
            {data.content.trim().split('\n')[0] || '내용이 없는 빈 노드입니다.'}
          </div>
        ) : (
          <div 
            className="w-full relative"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isLocked) {
                data.lockNode?.(id);
                setIsEditing(true);
              }
            }}
          >
            {isEditing && !isLocked ? (
              // 편집 상태
              <div onBlur={() => {
                setIsEditing(false);
                data.unlockNode?.(id);
                data.emitNodeHistoryAction?.(id, 'update'); // 본문 편집 포커스아웃 시 업데이트 기록
              }}>
                <MDEditor
                  value={data.content}
                  onChange={handleContentChange}
                  preview="edit"
                  extraCommands={[]}
                  height={220}
                  className="!border-dark-700/60"
                />
                <div className="flex justify-end gap-1.5 mt-2">
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      data.unlockNode?.(id);
                      data.emitNodeHistoryAction?.(id, 'update'); // 뷰어 강제 복귀 시 기록
                    }}
                    className="px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>뷰어 모드로 전환</span>
                  </button>
                </div>
              </div>
            ) : (
              // 뷰어 상태
              <div 
                className="max-h-[220px] overflow-y-auto cursor-text rounded border border-dark-700/40 p-2.5 bg-dark-900/40 hover:bg-dark-900/60 transition-colors"
                title="더블클릭하여 편집하기"
              >
                <MDEditor.Markdown 
                  source={data.content || '*내용이 없습니다.*'} 
                  className="!bg-transparent !text-xs !text-dark-200 prose prose-invert max-w-none"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
