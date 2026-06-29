// frontend/src/components/Dashboard.tsx
import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useProjectStore, type Project } from '../store/projectStore.js';
import { useAuthStore } from '../store/authStore.js';
import { confirmDialog } from '../store/confirmStore.js';
import { useModalDismiss } from '../hooks/useModalDismiss.js';
import { Plus, Settings, Trash2, UserPlus, RotateCcw, LogOut, Folder, FolderOpen, Shield, Users, X } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

export const Dashboard: React.FC = () => {
  const { logout, user, updateProfile } = useAuthStore();
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
  const invitedProjectCount = projects.filter((project) => project.role === 'member').length;

  const [newProjectName, setNewProjectName] = useState('');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'create' | 'rename' | 'invite' | null>(null);

  // 프로필 수정 상태
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');

  // 모달 데이터 캐싱
  const [targetProject, setTargetProject] = useState<Project | null>(null);
  const [modalInput, setModalInput] = useState('');

  const mainInputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname.trim() || newNickname.trim().length < 2) {
      showToast('닉네임은 2자 이상 입력해주세요.', 'error');
      return;
    }

    const confirmUpdate = await confirmDialog({
      title: '닉네임 변경',
      message: `닉네임을 "${newNickname}"(으)로 변경하시겠습니까?`,
      confirmText: '변경'
    });
    if (!confirmUpdate) return;

    const success = await updateProfile(newNickname);
    if (success) {
      showToast('프로필이 수정되었습니다.', 'success');
      setIsProfileEditOpen(false);
    } else {
      showToast('프로필 수정에 실패했습니다.', 'error');
    }
  };

  // 컴포넌트 로드 시 프로젝트 조회
  useEffect(() => {
    fetchProjects();
  }, []);

  // 다른 사용자의 초대/변경을 실시간으로 반영 (새로고침 없이)
  useEffect(() => {
    if (!user) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'], forceNew: true });
    socket.on('projects-updated', () => {
      fetchProjects();
    });
    return () => {
      socket.disconnect();
    };
  }, [user]);

  // 모달이 켜질 때 자동 포커스
  useEffect(() => {
    if (activeModal && modalInputRef.current) {
      modalInputRef.current.focus();
    }
  }, [activeModal]);

  useEffect(() => {
    if (isProfileEditOpen && profileInputRef.current) {
      profileInputRef.current.focus();
    }
  }, [isProfileEditOpen]);

  // 로비 인풋 기본 포커스
  useEffect(() => {
    if (!activeModal && !isTrashOpen && mainInputRef.current) {
      mainInputRef.current.focus();
    }
  }, [activeModal, isTrashOpen]);

  useModalDismiss(!!activeModal, () => { setActiveModal(null); setTargetProject(null); });
  useModalDismiss(isTrashOpen, () => setIsTrashOpen(false));
  useModalDismiss(isProfileEditOpen, () => setIsProfileEditOpen(false));

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
    const confirmRename = await confirmDialog({
      title: '프로젝트 이름 변경',
      message: `프로젝트 이름을 "${targetProject.name}"에서 "${modalInput}"(으)로 변경하시겠습니까?`,
      confirmText: '변경'
    });
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
    const confirmDelete = await confirmDialog({
      title: '프로젝트 삭제',
      message: `정말로 프로젝트 "${project.name}"을(를) 삭제하시겠습니까?\n삭제된 프로젝트는 휴지통에서 언제든지 복구할 수 있습니다.`,
      confirmText: '삭제',
      danger: true
    });
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
    <div className="min-h-screen bg-[#f4f5f7] text-[#172b4d] flex flex-col relative overflow-hidden">

      {/* 헤더 바 */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-level2 shadow-sm">
        <div
          onClick={() => selectProject(null)}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-[#00875a] flex items-center justify-center font-bold text-white shadow-md">
            이음
          </div>
          <span className="font-extrabold text-xl tracking-tight text-gray-900">
            이음
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-sm">
            <Shield className="w-4 h-4 text-[#00875a]" />
            <span className="font-semibold text-gray-700">
              {user?.nickname ? `${user.nickname} (${user.email})` : user?.email}
            </span>
            <button
              onClick={() => {
                setNewNickname(user?.nickname || '');
                setIsProfileEditOpen(true);
              }}
              className="ml-1 text-xs text-[#00875a] hover:underline font-bold"
            >
              [수정]
            </button>
          </div>

          <button
            onClick={openTrash}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-sm font-semibold transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
            <span>휴지통</span>
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100/50 text-rose-600 text-sm font-semibold transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      {/* 메인 대시보드 콘텐츠 */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 relative z-level2 flex flex-col gap-8">

        {/* 신규 프로젝트 생성 폼 */}
        <section className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
            <FolderOpen className="w-5 h-5 text-[#00875a]" />
            <span>새로운 프로젝트 시작하기</span>
          </h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              ref={mainInputRef}
              type="text"
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="프로젝트명을 입력하세요 (예: 2026 이음 리팩토링)"
              className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00875a] focus:ring-2 focus:ring-[#00875a]/10 transition-all font-semibold"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 rounded-xl bg-[#172b4d] text-white font-bold hover:bg-[#091e42] active:scale-[0.98] transition-all flex items-center gap-2 shadow-md"
            >
              <Plus className="w-5 h-5" />
              <span>생성</span>
            </button>
          </form>
        </section>

        {/* 프로젝트 목록 섹션 */}
        <section className="flex-1 flex flex-col gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
            <Folder className="w-6 h-6 text-[#00875a]" />
            <span>내 워크스페이스 목록</span>
            <span className="text-sm font-semibold text-gray-500 px-2 py-0.5 rounded-full bg-white border border-gray-200">
              {projects.length}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="px-2.5 py-1 rounded-full bg-[#e6f4ea] border border-[#00875a]/20 text-[#00875a] font-bold">
              받은 초대 {invitedProjectCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 font-medium">
              초대를 받으면 이 목록에 워크스페이스가 표시됩니다.
            </span>
          </div>

          {isLoading && projects.length === 0 ? (
            // 스케치 로딩 스켈레톤
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-40 rounded-2xl border border-gray-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-2xl p-16 text-center text-gray-400 font-semibold bg-white shadow-sm space-y-2">
              <div>워크스페이스가 비어있습니다.</div>
              <div className="text-sm font-medium text-gray-300">
                새 프로젝트를 생성하거나, 초대를 받으면 여기에 자동으로 표시됩니다.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative rounded-2xl border border-gray-200 bg-white hover:border-[#00875a]/50 hover:shadow-lg transition-all duration-300 p-6 flex flex-col justify-between shadow-sm"
                >
                  {/* 카드 헤더 및 진입 링크 */}
                  <div
                    onClick={() => selectProject(project)}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md border ${project.role === 'owner'
                        ? 'bg-[#e6f4ea] border-[#00875a]/30 text-[#00875a]'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                        {project.role === 'owner' ? 'Owner' : 'Member · 초대됨'}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#00875a] transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">
                      생성일: {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* 카드 하단 관리 액션 */}
                  <div className="flex items-center justify-between border-t border-gray-150 pt-4 mt-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1 font-semibold">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
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
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <Settings className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => {
                              setTargetProject(project);
                              setModalInput('');
                              setActiveModal('invite');
                            }}
                            title="멤버 초대"
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <UserPlus className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(project)}
                            title="프로젝트 삭제"
                            className="p-2 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
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
        <div
          className="fixed inset-0 z-level4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setActiveModal(null); setTargetProject(null); }}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl border border-gray-200 bg-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setActiveModal(null); setTargetProject(null); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
              {activeModal === 'rename' ? <Settings className="w-5 h-5 text-[#00875a]" /> : <UserPlus className="w-5 h-5 text-[#00875a]" />}
              <span>{activeModal === 'rename' ? '프로젝트 이름 변경' : '새로운 멤버 초대'}</span>
            </h3>

            <form onSubmit={activeModal === 'rename' ? handleRenameSubmit : handleInviteSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-semibold uppercase">
                  {activeModal === 'rename' ? '수정할 프로젝트 명' : '초대 멤버 이메일 주소'}
                </label>
                <input
                  ref={modalInputRef}
                  type={activeModal === 'rename' ? 'text' : 'email'}
                  required
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder={activeModal === 'rename' ? '새 이름을 입력하세요' : 'example@e-im.com'}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00875a] focus:ring-2 focus:ring-[#00875a]/10 transition-all font-semibold"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setActiveModal(null); setTargetProject(null); }}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00875a] text-white font-bold hover:bg-[#006644] transition-all shadow-md"
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
        <div
          className="fixed inset-0 z-level4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setIsTrashOpen(false)}
        >
          <div
            className="w-full max-w-2xl p-6 rounded-2xl border border-gray-200 bg-white shadow-2xl relative max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsTrashOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-gray-200 pb-3 text-gray-900">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <span>휴지통 (삭제된 내 프로젝트)</span>
            </h3>

            <div className="flex-1 overflow-y-auto min-h-[300px] py-2">
              {trashProjects.length === 0 ? (
                <div className="text-center text-gray-400 py-16 font-semibold">
                  휴지통이 비어있습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {trashProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100/55 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-gray-900 line-clamp-1">{project.name}</h4>
                        <p className="text-xs text-gray-400 mt-1 font-medium">
                          삭제 일자: {project.deletedAt ? new Date(project.deletedAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const confirmRestore = await confirmDialog({
                            title: '프로젝트 복구',
                            message: `"${project.name}" 프로젝트를 복구하시겠습니까?`,
                            confirmText: '복구'
                          });
                          if (confirmRestore) {
                            await restoreProject(project.id);
                          }
                        }}
                        className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-[#00875a] text-xs font-bold transition-colors shadow-sm"
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

      {/* 모달: 프로필 수정 */}
      {isProfileEditOpen && (
        <div
          className="fixed inset-0 z-level4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setIsProfileEditOpen(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl border border-gray-200 bg-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsProfileEditOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
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
