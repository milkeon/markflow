// frontend/src/components/Dashboard.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useProjectStore, type Project } from '../store/projectStore.js';
import { useAuthStore } from '../store/authStore.js';
import { Plus, Settings, Trash2, UserPlus, RotateCcw, LogOut, Folder, FolderOpen, Shield, Users, X } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { logout, user } = useAuthStore();
  const {
    projects,
    trashProjects,
    isLoading,
    fetchProjects,
    createProject,
    renameProject,
    deleteProject,
    inviteMember,
    fetchTrashProjects,
    restoreProject,
    selectProject,
    showToast
  } = useProjectStore();

  const [newProjectName, setNewProjectName] = useState('');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'create' | 'rename' | 'invite' | null>(null);
  
  // 모달 데이터 캐싱
  const [targetProject, setTargetProject] = useState<Project | null>(null);
  const [modalInput, setModalInput] = useState('');
  
  const mainInputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // 컴포넌트 로드 시 프로젝트 조회
  useEffect(() => {
    fetchProjects();
  }, []);

  // 모달이 켜질 때 자동 포커스
  useEffect(() => {
    if (activeModal && modalInputRef.current) {
      modalInputRef.current.focus();
    }
  }, [activeModal]);

  // 로비 인풋 기본 포커스
  useEffect(() => {
    if (!activeModal && !isTrashOpen && mainInputRef.current) {
      mainInputRef.current.focus();
    }
  }, [activeModal, isTrashOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const success = await createProject(newProjectName);
    if (success) {
      setNewProjectName('');
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProject || !modalInput.trim()) return;
    
    // UI/UX 규칙: 수정 완료 시에는 항상 한번더 확인문구 보여줌
    const confirmRename = window.confirm(`프로젝트 이름을 "${targetProject.name}"에서 "${modalInput}"(으)로 변경하시겠습니까?`);
    if (!confirmRename) return;

    const success = await renameProject(targetProject.id, modalInput);
    if (success) {
      setActiveModal(null);
      setTargetProject(null);
      setModalInput('');
    }
  };

  const handleDeleteClick = async (project: Project) => {
    // UI/UX 규칙: 삭제 완료 시에는 항상 한번더 확인문구 보여줌
    const confirmDelete = window.confirm(`정말로 프로젝트 "${project.name}"을(를) 삭제하시겠습니까?\n삭제된 프로젝트는 휴지통에서 언제든지 복구할 수 있습니다.`);
    if (!confirmDelete) return;

    const success = await deleteProject(project.id);
    if (success) {
      showToast(`"${project.name}" 프로젝트가 삭제되었습니다.`);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProject || !modalInput.trim()) return;
    const success = await inviteMember(targetProject.id, modalInput);
    if (success) {
      setActiveModal(null);
      setTargetProject(null);
      setModalInput('');
    }
  };

  const openTrash = async () => {
    setIsTrashOpen(true);
    await fetchTrashProjects();
  };

  return (
    <div className="min-h-screen bg-transparent text-dark-800 flex flex-col relative overflow-hidden">
      {/* 백그라운드 그라데이션 광원 */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* 헤더 바 */}
      <header className="border-b border-dark-700 bg-dark-800/40 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-level2">
        <div 
          onClick={() => selectProject(null)} 
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
            M
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-dark-100 to-dark-400 bg-clip-text text-transparent">
            MarkFlow
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-800 border border-dark-700 text-sm">
            <Shield className="w-4 h-4 text-brand-400" />
            <span className="font-semibold text-dark-200">{user?.email}</span>
          </div>

          <button 
            onClick={openTrash}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 text-sm font-semibold transition-colors"
          >
            <Trash2 className="w-4 h-4 text-dark-400" />
            <span>휴지통</span>
          </button>

          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/40 text-rose-300 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      {/* 메인 대시보드 콘텐츠 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 relative z-level2 flex flex-col gap-8">
        
        {/* 신규 프로젝트 생성 폼 */}
        <section className="bg-dark-800/40 border border-dark-700/60 p-6 rounded-2xl backdrop-blur-md">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-400" />
            <span>새로운 프로젝트 시작하기</span>
          </h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              ref={mainInputRef}
              type="text"
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="프로젝트명을 입력하세요 (예: 2026 MarkFlow 리팩토링)"
              className="flex-1 px-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-semibold"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg shadow-brand-600/25 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>생성</span>
            </button>
          </form>
        </section>

        {/* 프로젝트 목록 섹션 */}
        <section className="flex-1 flex flex-col gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Folder className="w-6 h-6 text-brand-400" />
            <span>내 워크스페이스 목록</span>
            <span className="text-sm font-semibold text-dark-400 px-2 py-0.5 rounded-full bg-dark-800 border border-dark-700">
              {projects.length}
            </span>
          </h2>

          {isLoading && projects.length === 0 ? (
            // 스케치 로딩 스켈레톤
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-40 rounded-2xl border border-dark-700 bg-dark-800/20 animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="border border-dashed border-dark-700 rounded-2xl p-16 text-center text-dark-400 font-semibold bg-dark-800/10">
              워크스페이스가 비어있습니다. 위의 입력창을 이용해 첫 프로젝트를 생성해보세요!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  className="group relative rounded-2xl border border-dark-700/80 bg-dark-800/40 hover:border-brand-500/50 hover:bg-dark-800/80 transition-all duration-300 p-6 flex flex-col justify-between shadow-lg"
                >
                  {/* 카드 헤더 및 진입 링크 */}
                  <div 
                    onClick={() => selectProject(project)}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                        project.role === 'owner' 
                          ? 'bg-brand-950/60 border-brand-500/40 text-brand-300' 
                          : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                      }`}>
                        {project.role === 'owner' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-white group-hover:text-brand-400 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <p className="text-xs text-dark-400 mt-2 font-medium">
                      생성일: {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* 카드 하단 관리 액션 */}
                  <div className="flex items-center justify-between border-t border-dark-700/60 pt-4 mt-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-dark-300 flex items-center gap-1 font-semibold">
                        <Users className="w-3.5 h-3.5 text-dark-400" />
                        {project.role === 'owner' ? '멤버 제어 가능' : '뷰어 전용'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {project.role === 'owner' && (
                        <>
                          <button
                            onClick={() => {
                              setTargetProject(project);
                              setModalInput(project.name);
                              setActiveModal('rename');
                            }}
                            title="이름 변경"
                            className="p-2 rounded-lg bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors"
                          >
                            <Settings className="w-4 h-4 text-dark-300" />
                          </button>
                          <button
                            onClick={() => {
                              setTargetProject(project);
                              setModalInput('');
                              setActiveModal('invite');
                            }}
                            title="멤버 초대"
                            className="p-2 rounded-lg bg-dark-900 border border-dark-700 hover:bg-dark-700 transition-colors"
                          >
                            <UserPlus className="w-4 h-4 text-dark-300" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(project)}
                            title="프로젝트 삭제"
                            className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/40 hover:bg-rose-900/60 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 모달: 이름 변경 및 멤버 초대 */}
      {activeModal && (
        <div className="fixed inset-0 z-level4 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-dark-700 bg-dark-800 shadow-2xl relative">
            <button 
              onClick={() => { setActiveModal(null); setTargetProject(null); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              {activeModal === 'rename' ? <Settings className="w-5 h-5 text-brand-400" /> : <UserPlus className="w-5 h-5 text-brand-400" />}
              <span>{activeModal === 'rename' ? '프로젝트 이름 변경' : '새로운 멤버 초대'}</span>
            </h3>

            <form onSubmit={activeModal === 'rename' ? handleRenameSubmit : handleInviteSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold uppercase">
                  {activeModal === 'rename' ? '수정할 프로젝트 명' : '초대 멤버 이메일 주소'}
                </label>
                <input
                  ref={modalInputRef}
                  type={activeModal === 'rename' ? 'text' : 'email'}
                  required
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder={activeModal === 'rename' ? '새 이름을 입력하세요' : 'example@markflow.com'}
                  className="w-full px-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-semibold"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setActiveModal(null); setTargetProject(null); }}
                  className="px-4 py-2 rounded-xl bg-dark-900 border border-dark-700 hover:bg-dark-700 text-dark-200 font-bold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-lg shadow-brand-600/10"
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달: 휴지통 열기 */}
      {isTrashOpen && (
        <div className="fixed inset-0 z-level4 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl p-6 rounded-2xl border border-dark-700 bg-dark-800 shadow-2xl relative max-h-[80vh] flex flex-col">
            <button 
              onClick={() => setIsTrashOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-dark-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-dark-700 pb-3">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>휴지통 (삭제된 내 프로젝트)</span>
            </h3>

            <div className="flex-1 overflow-y-auto min-h-[300px] py-2">
              {trashProjects.length === 0 ? (
                <div className="text-center text-dark-400 py-16 font-semibold">
                  휴지통이 비어있습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {trashProjects.map((project) => (
                    <div 
                      key={project.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-dark-700 bg-dark-900/60 hover:bg-dark-900 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-white line-clamp-1">{project.name}</h4>
                        <p className="text-xs text-dark-400 mt-1 font-medium">
                          삭제 일자: {project.deletedAt ? new Date(project.deletedAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const confirmRestore = window.confirm(`"${project.name}" 프로젝트를 복구하시겠습니까?`);
                          if (confirmRestore) {
                            await restoreProject(project.id);
                          }
                        }}
                        className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-brand-950/60 border border-brand-500/40 text-brand-300 text-xs font-bold hover:bg-brand-900/60 transition-colors"
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
