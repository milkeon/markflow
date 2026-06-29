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
import { confirmDialog } from './confirmStore.js';

// 마크다운 노드 데이터 커스텀 인터페이스
export interface MarkdownNodeData extends Record<string, any> {
  title: string;
  content: string;
  isCollapsed: boolean;
  editingUser?: string;
  deletedAt?: string;
  category?: 'idea' | 'document' | 'decision' | 'todo' | 'data';
  emitNodeHistoryAction?: (nodeId: string, action: 'create' | 'update' | 'delete' | 'restore') => void;
}

interface CanvasSnapshot {
  nodes: Node<MarkdownNodeData>[];
  edges: Edge[];
  trashNodes: Node<MarkdownNodeData>[];
}

const MAX_HISTORY = 50;

interface CanvasState {
  nodes: Node<MarkdownNodeData>[];
  trashNodes: Node<MarkdownNodeData>[];
  edges: Edge[];
  isLoading: boolean;
  isSaving: boolean;
  saveTimer: NodeJS.Timeout | null;
  isIncomingUpdate: boolean;
  setIncomingUpdate: (val: boolean) => void;

  // 실행 취소/다시 실행
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  pushHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;

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
  addMarkdownNode: (x: number, y: number, category?: 'idea' | 'document' | 'decision' | 'todo' | 'data') => string | null;
  updateNodeData: (nodeId: string, updates: Partial<MarkdownNodeData>) => void;
  softDeleteNode: (nodeId: string) => Promise<boolean>;
  getDeletedNodes: () => Node<MarkdownNodeData>[];
  restoreNode: (nodeId: string) => Promise<boolean>;

  // 상태 초기화
  clearCanvas: () => void;
}

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

const getAuthHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// pushHistory 코얼레싱 가드: 키 입력 1번이 onNodesChange + onEdgesChange처럼
// 같은 동기 실행 구간에서 여러 번 호출되는 걸 1개의 undo 체크포인트로 합친다
let historyTxOpen = false;

// 로컬에서 지금 드래그 중인 노드 id 집합. 리렌더가 필요 없는 순수 좌표용 플래그라
// zustand state가 아니라 모듈 레벨 Set으로 둔다.
// 원격에서 전체 nodes 배열이 도착해도, 내가 지금 드래그 중인 노드의 위치는
// 그 배열로 덮어쓰지 않는다 (안 그러면 드래그 중에 노드가 혼자 움직이는 것처럼 보임).
export const localDraggingNodeIds = new Set<string>();

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  trashNodes: [],
  edges: [],
  isLoading: false,
  isSaving: false,
  saveTimer: null,
  isIncomingUpdate: false,
  setIncomingUpdate: (val) => set({ isIncomingUpdate: val }),

  past: [],
  future: [],

  // 변경 직전 상태를 히스토리에 적재 (원격 수신 적용 중에는 기록하지 않음)
  pushHistory: () => {
    if (historyTxOpen) return;
    const state = get();
    if (state.isIncomingUpdate) return;

    historyTxOpen = true;
    queueMicrotask(() => {
      historyTxOpen = false;
    });

    const snapshot: CanvasSnapshot = {
      nodes: state.nodes,
      edges: state.edges,
      trashNodes: state.trashNodes
    };
    set({
      past: [...state.past, snapshot].slice(-MAX_HISTORY),
      future: []
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    const current: CanvasSnapshot = { nodes: state.nodes, edges: state.edges, trashNodes: state.trashNodes };
    set({
      ...previous,
      past: state.past.slice(0, -1),
      future: [current, ...state.future]
    });
    const currentProj = useProjectStore.getState().currentProject;
    if (currentProj) get().triggerAutoSave(currentProj.id);
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    const current: CanvasSnapshot = { nodes: state.nodes, edges: state.edges, trashNodes: state.trashNodes };
    set({
      ...next,
      past: [...state.past, current],
      future: state.future.slice(1)
    });
    const currentProj = useProjectStore.getState().currentProject;
    if (currentProj) get().triggerAutoSave(currentProj.id);
  },

  loadCanvas: async (projectId) => {
    set({ isLoading: true, past: [], future: [] });
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/canvas`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '캔버스를 불러오지 못했습니다.');

      const canvasData = data.data || { nodes: [], edges: [], trashNodes: [] };
      const incomingNodes = Array.isArray(canvasData.nodes) ? canvasData.nodes : [];
      const incomingTrashNodes = Array.isArray(canvasData.trashNodes) ? canvasData.trashNodes : [];
      const migratedTrashNodes = incomingNodes.filter((node: any) => node?.data?.deletedAt !== undefined);
      const activeNodes = incomingNodes.filter((node: any) => node?.data?.deletedAt === undefined);
      const activeNodeIds = new Set(activeNodes.map((node: any) => node.id));
      // 과거에 정리되지 않고 남아있던, 존재하지 않는 노드를 가리키는 허깨비 엣지를 걸러낸다
      const incomingEdges = Array.isArray(canvasData.edges) ? canvasData.edges : [];
      const cleanedEdges = incomingEdges.filter(
        (edge: any) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)
      );
      set({
        nodes: activeNodes,
        trashNodes: [...incomingTrashNodes, ...migratedTrashNodes],
        edges: cleanedEdges,
        isLoading: false
      });
    } catch (err: any) {
      console.error(err.message);
      set({ nodes: [], trashNodes: [], edges: [], isLoading: false });
    }
  },

  saveCanvas: async (projectId) => {
    set({ isSaving: true });
    const { nodes, edges, trashNodes } = get();
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/canvas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          data: { nodes, edges, trashNodes }
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

    // 자동저장 디바운스: 500ms
    const timer = setTimeout(() => {
      get().saveCanvas(projectId);
    }, 500);

    set({ saveTimer: timer });
  },

  onNodesChange: (changes) => {
    // 삭제는 즉시 한 번 적재. 드래그 이동은 onNodeDragStart/onSelectionDragStart에서
    // 제스처 시작 시점에 1번만 적재한다 (여기서 dragging 플래그로 추론하면 변경 묶음에 따라
    // 여러 번/늦게 찍혀 undo 1번에 여러 동작이 같이 풀리는 문제가 생긴다).
    const isHistoryPoint = changes.some((change: any) => change.type === 'remove');
    if (isHistoryPoint) get().pushHistory();

    set((state) => {
      const removeIds = changes
        .filter((change: any) => change.type === 'remove')
        .map((change: any) => change.id);
      const nonRemoveChanges = changes.filter((change: any) => change.type !== 'remove');
      let updatedNodes = applyNodeChanges(nonRemoveChanges as any, state.nodes) as Node<MarkdownNodeData>[];
      let updatedTrashNodes = state.trashNodes;

      if (removeIds.length > 0) {
        const removedNodes = state.nodes.filter((node) => removeIds.includes(node.id));
        const removedNodesMap = new Map(removedNodes.map((node) => [node.id, node]));
        const removedAt = new Date().toISOString();

        updatedNodes = updatedNodes.filter((node) => !removeIds.includes(node.id));
        updatedTrashNodes = [
          ...state.trashNodes.filter((node) => !removeIds.includes(node.id)),
          ...removeIds
            .map((id) => removedNodesMap.get(id))
            .filter((node): node is Node<MarkdownNodeData> => !!node)
            .map((node) => ({
              ...node,
              data: {
                ...node.data,
                deletedAt: node.data.deletedAt ?? removedAt
              }
            }))
        ];
      }

      // 노드 삭제 시 연결된 엣지도 같이 정리 (허깨비 엣지 방지)
      const updatedEdges = removeIds.length > 0
        ? state.edges.filter((edge) => !removeIds.includes(edge.source) && !removeIds.includes(edge.target))
        : state.edges;

      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj) {
        setTimeout(() => get().triggerAutoSave(currentProj.id), 0);
      }

      return { nodes: updatedNodes, edges: updatedEdges, trashNodes: updatedTrashNodes };
    });
  },

  onEdgesChange: (changes) => {
    const isHistoryPoint = changes.some((change: any) => change.type === 'remove');
    if (isHistoryPoint) get().pushHistory();

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
    get().pushHistory();
    set((state) => {
      const updatedEdges = addEdge(connection, state.edges);

      const currentProj = useProjectStore.getState().currentProject;
      if (currentProj) {
        setTimeout(() => get().triggerAutoSave(currentProj.id), 0);
      }

      return { edges: updatedEdges };
    });
  },

  addMarkdownNode: (x, y, category) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return null;
    get().pushHistory();

    const { nodes } = get();

    // 1. 제목 자동 넘버링: 현재 활성 노드 수 + 1
    const activeCount = nodes.length;
    const title = `새 노드 ${activeCount + 1}`;

    // 2. 위치 충돌 방지: 기존 노드와 충분히 떨어진 위치 탐색 (최소 거리 200px)
    const MIN_DIST = 200;
    const GRID = 220; // 탐색 격자 단계
    let posX = x;
    let posY = y;

    // 기존 활성 노드 위치 목록
    const activePositions = nodes.map(n => n.position);

    // 충돌 체크 함수
    const isTooClose = (cx: number, cy: number) =>
      activePositions.some(p => Math.hypot(p.x - cx, p.y - cy) < MIN_DIST);

    // 가까운 노드가 있으면 나선형으로 후보 위치를 탐색
    if (isTooClose(posX, posY)) {
      const offsets = [
        [GRID, 0], [-GRID, 0], [0, GRID], [0, -GRID],
        [GRID, GRID], [-GRID, GRID], [GRID, -GRID], [-GRID, -GRID],
        [GRID * 2, 0], [0, GRID * 2], [-GRID * 2, 0], [0, -GRID * 2],
        [GRID * 2, GRID], [GRID, GRID * 2], [-GRID * 2, GRID], [-GRID, GRID * 2]
      ];
      for (const [dx, dy] of offsets) {
        const cx = x + dx;
        const cy = y + dy;
        if (!isTooClose(cx, cy)) {
          posX = cx;
          posY = cy;
          break;
        }
      }
    }

    const id = `node_${Date.now()}`;
    const newNode: Node<MarkdownNodeData> = {
      id,
      type: 'markdown',
      position: { x: posX, y: posY },
      data: {
        title,
        content: '',
        isCollapsed: false,
        category: category || 'idea'
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

  softDeleteNode: async (nodeId) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return false;

    const confirmDelete = await confirmDialog({
      title: '노드 삭제',
      message: '이 마크다운 노드를 삭제하시겠습니까?\n삭제된 노드는 휴지통에서 복구할 수 있습니다.',
      confirmText: '삭제',
      danger: true
    });
    if (!confirmDelete) return false;

    const target = get().nodes.find((node) => node.id === nodeId);
    if (!target) return false;

    get().pushHistory();
    set((state) => {
      const deletedNode = {
        ...target,
        data: {
          ...target.data,
          deletedAt: new Date().toISOString()
        }
      };

      return {
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        // 휴지통 이동 = soft delete + 연결된 엣지는 물리 삭제 (복구 대상 아님, 허깨비 엣지 방지)
        edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        trashNodes: [
          ...state.trashNodes.filter((node) => node.id !== nodeId),
          deletedNode
        ]
      };
    });

    get().triggerAutoSave(currentProj.id);
    useProjectStore.getState().showToast('노드가 휴지통으로 이동되었습니다.', 'info');
    return true;
  },

  getDeletedNodes: () => {
    return get().trashNodes;
  },

  restoreNode: async (nodeId) => {
    const currentProj = useProjectStore.getState().currentProject;
    if (!currentProj) return false;

    const confirmRestore = await confirmDialog({
      title: '노드 복구',
      message: '삭제된 노드를 복구하시겠습니까?',
      confirmText: '복구'
    });
    if (!confirmRestore) return false;

    const target = get().trashNodes.find((node) => node.id === nodeId);
    if (!target) return false;

    get().pushHistory();
    set((state) => {
      const { deletedAt, ...cleanedData } = target.data;
      const restoredNode: Node<MarkdownNodeData> = {
        ...target,
        data: cleanedData as MarkdownNodeData
      };

      return {
        nodes: [...state.nodes.filter((node) => node.id !== nodeId), restoredNode],
        trashNodes: state.trashNodes.filter((node) => node.id !== nodeId)
      };
    });

    get().triggerAutoSave(currentProj.id);
    useProjectStore.getState().showToast('노드가 복구되었습니다.', 'success');
    return true;
  },

  clearCanvas: () => {
    const { saveTimer } = get();
    if (saveTimer) clearTimeout(saveTimer);
    set({ nodes: [], trashNodes: [], edges: [], saveTimer: null, past: [], future: [] });
  }
}));
