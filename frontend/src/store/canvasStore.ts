// frontend/src/store/canvasStore.ts
import { create } from 'zustand';
import { 
  applyNodeChanges,
  applyEdgeChanges,
  addEdge
} from '@xyflow/react';
import type {
  Node, 
  Edge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect
} from '@xyflow/react';
import { useAuthStore } from './authStore.js';
import { useProjectStore } from './projectStore.js';

// 마크다운 노드 데이터 커스텀 인터페이스
export interface MarkdownNodeData extends Record<string, any> {
  title: string;
  content: string;
  isCollapsed: boolean;
  editingUser?: string;
  deletedAt?: string;
  emitNodeHistoryAction?: (nodeId: string, action: 'create' | 'update' | 'delete' | 'restore') => void;
}

interface CanvasState {
  nodes: Node<MarkdownNodeData>[];
  edges: Edge[];
  isLoading: boolean;
  isSaving: boolean;
  saveTimer: NodeJS.Timeout | null;

  // 캔버스 데이터 불러오기
  loadCanvas: (projectId: string) => Promise<void>;
  // 캔버스 데이터 수동 저장
  saveCanvas: (projectId: string) => Promise<void>;
  // 자동 저장 디바운스 트리거
  triggerAutoSave: (projectId: string) => void;

  // React Flow 이벤트 바인딩
  onNodesChange: OnNodesChange<Node<MarkdownNodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // 노드 조작 메서드 (리턴 타입 변경: ID 및 성공 여부 반환)
  addMarkdownNode: (x: number, y: number) => string | null;
  updateNodeData: (nodeId: string, updates: Partial<MarkdownNodeData>) => void;
  softDeleteNode: (nodeId: string) => boolean;
  getDeletedNodes: () => Node<MarkdownNodeData>[];
  restoreNode: (nodeId: string) => boolean;
  
  // 상태 초기화
  clearCanvas: () => void;
}

const API_URL = 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  isLoading: false,
  isSaving: false,
  saveTimer: null,

  loadCanvas: async (projectId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/canvas`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '캔버스를 불러오지 못했습니다.');
      
      const canvasData = data.data || { nodes: [], edges: [] };
      set({ 
        nodes: canvasData.nodes || [], 
        edges: canvasData.edges || [],
        isLoading: false 
      });
    } catch (err: any) {
      console.error(err.message);
      set({ nodes: [], edges: [], isLoading: false });
    }
  },

  saveCanvas: async (projectId) => {
    set({ isSaving: true });
    const { nodes, edges } = get();
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/canvas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          data: { nodes, edges }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '캔버스 저장에 실패했습니다.');
      set({ isSaving: false });
    } catch (err: any) {
      console.error('캔버스 저장 실패:', err.message);
      set({ isSaving: false });
    }
  },

  triggerAutoSave: (projectId) => {
    const { saveTimer } = get();
    if (saveTimer) clearTimeout(saveTimer);

    const timer = setTimeout(() => {
      get().saveCanvas(projectId);
    }, 2000);

    set({ saveTimer: timer });
  },

  onNodesChange: (changes) => {
    set((state) => {
      const updatedNodes = applyNodeChanges(changes, state.nodes) as Node<MarkdownNodeData>[];
      
      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj) {
        setTimeout(() => get().triggerAutoSave(currentProj.id), 0);
      }

      return { nodes: updatedNodes };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => {
      const updatedEdges = applyEdgeChanges(changes, state.edges);
      
      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj) {
        setTimeout(() => get().triggerAutoSave(currentProj.id), 0);
      }

      return { edges: updatedEdges };
    });
  },

  onConnect: (connection) => {
    set((state) => {
      const updatedEdges = addEdge(connection, state.edges);
      
      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj) {
        setTimeout(() => get().triggerAutoSave(currentProj.id), 0);
      }

      return { edges: updatedEdges };
    });
  },

  addMarkdownNode: (x, y) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return null;

    const id = `node_${Date.now()}`;
    const newNode: Node<MarkdownNodeData> = {
      id,
      type: 'markdown',
      position: { x, y },
      data: {
        title: '새로운 메모 노드',
        content: '마크다운을 더블클릭하여 편집해보세요.\n\n- 항목 1\n- 항목 2\n\n```js\nconsole.log("MarkFlow!");\n```',
        isCollapsed: false
      }
    };

    set((state) => ({ nodes: [...state.nodes, newNode] }));
    get().triggerAutoSave(currentProj.id);
    return id;
  },

  updateNodeData: (nodeId, updates) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return;

    set((state) => {
      const updatedNodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updates
            }
          };
        }
        return node;
      });

      return { nodes: updatedNodes };
    });

    get().triggerAutoSave(currentProj.id);
  },

  softDeleteNode: (nodeId) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return false;

    const confirmDelete = window.confirm('이 마크다운 노드를 삭제하시겠습니까?\n삭제된 노드는 휴지통에서 복구할 수 있습니다.');
    if (!confirmDelete) return false;

    set((state) => {
      const updatedNodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              deletedAt: new Date().toISOString()
            }
          };
        }
        return node;
      });

      return { nodes: updatedNodes };
    });

    get().triggerAutoSave(currentProj.id);
    useProjectStore.getState().showToast('노드가 휴지통으로 이동되었습니다.', 'info');
    return true;
  },

  getDeletedNodes: () => {
    return get().nodes.filter(node => node.data.deletedAt !== undefined);
  },

  restoreNode: (nodeId) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return false;

    const confirmRestore = window.confirm('삭제된 노드를 복구하시겠습니까?');
    if (!confirmRestore) return false;

    set((state) => {
      const updatedNodes = state.nodes.map((node) => {
        if (node.id === nodeId) {
          const { deletedAt, ...cleanedData } = node.data;
          return {
            ...node,
            data: cleanedData as MarkdownNodeData
          };
        }
        return node;
      });

      return { nodes: updatedNodes };
    });

    get().triggerAutoSave(currentProj.id);
    useProjectStore.getState().showToast('노드가 복구되었습니다.', 'success');
    return true;
  },

  clearCanvas: () => {
    const { saveTimer } = get();
    if (saveTimer) clearTimeout(saveTimer);
    set({ nodes: [], edges: [], saveTimer: null });
  }
}));
