import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, MessageSquarePlus, Loader2 } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'UI/디자인' | '오류/버그' | '기능 제안' | '기타';

export const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const [type, setType] = useState<FeedbackType>('기능 제안');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const types: FeedbackType[] = ['기능 제안', 'UI/디자인', '오류/버그', '기타'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      await addDoc(collection(db, 'feedbacks'), {
        type,
        content: content.trim(),
        userEmail: user.email || 'unknown',
        userName: user.displayName || 'unknown',
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setContent('');
    } catch (err: any) {
      console.error('Feedback submit error:', err);
      setError(err?.message || '개선 제안 제출에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError('');
    setContent('');
    setType('기능 제안');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 tracking-tight">시스템 개선 제안</h3>
                  <p className="text-xs font-bold text-slate-500">IMA 생산/재고 시스템 개선사항 접수</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="px-8 pb-8">
              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center text-center py-8 space-y-4"
                >
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-lg text-slate-900">제안이 완료되었습니다!</h4>
                    <p className="text-sm font-semibold text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                      작성해주신 소중한 조언을 바탕으로 한층 더 발전하는 서비스를 제공하겠습니다.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="mt-4 px-6 py-3 bg-primary text-white font-extrabold rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95"
                  >
                    확인
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 block ml-1">제안 종류</label>
                    <div className="grid grid-cols-4 gap-2">
                      {types.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`py-2 rounded-xl text-xs font-black transition-all border ${
                            type === t
                              ? 'bg-primary border-primary text-white shadow-md shadow-primary/10'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 block ml-1">상세 내용</label>
                    <textarea
                      required
                      rows={5}
                      maxLength={4000}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="제품 오류, 추가 요구 사항, UI/UX 개선 제의 등 시스템 운영상 불편한 점 또는 원하시는 개선 사항을 편하게 적어주세요."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-sm text-slate-800 outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
                    />
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 px-1">
                      <span>* 제출된 제안은 개발팀에서 즉시 검토합니다.</span>
                      <span>{content.length} / 4000자</span>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-4 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 font-extrabold text-sm rounded-2xl transition-all"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !content.trim()}
                      className="flex-1 py-4 bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:pointer-events-none font-extrabold text-sm rounded-2xl shadow-xl shadow-primary/10 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>개선사항 제안하기</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
