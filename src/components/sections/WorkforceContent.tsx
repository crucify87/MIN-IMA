import React, { useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { CalendarDays, ClipboardList, Pencil, Plus, TrendingUp, Trash2, Users, X } from 'lucide-react';
import { db } from '../../lib/firebase';

const departments = ['재고', '물류', '생산'] as const;
const attendanceStatuses = ['출근', '지각', '조퇴', '결근', '연차', '반차', '휴무'] as const;
const tabs = [
  { id: 'assignment', label: '인원배치', icon: Users },
  { id: 'efficiency', label: '효율', icon: TrendingUp },
  { id: 'attendance', label: '근태', icon: CalendarDays },
] as const;
type Tab = typeof tabs[number]['id'];

interface WorkforceForm {
  name: string;
  department: typeof departments[number];
  task: string;
  shift: string;
  plannedHours: string;
  actualHours: string;
  target: string;
  completed: string;
  unit: string;
  attendance: typeof attendanceStatuses[number];
  checkIn: string;
  checkOut: string;
  overtime: string;
  notes: string;
}

interface WorkforceRecord extends Omit<WorkforceForm, 'plannedHours' | 'actualHours' | 'target' | 'completed' | 'overtime'> {
  id: string;
  date: string;
  plannedHours: number;
  actualHours: number;
  target: number;
  completed: number;
  overtime: number;
}

const emptyForm: WorkforceForm = {
  name: '', department: '재고', task: '', shift: '주간', plannedHours: '8',
  actualHours: '0', target: '0', completed: '0', unit: '건', attendance: '출근',
  checkIn: '', checkOut: '', overtime: '0', notes: '',
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';
const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-xs font-bold text-slate-600">{label}{children}</label>;
}

export default function WorkforceContent({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<Tab>('assignment');
  const [date, setDate] = useState(localToday);
  const [department, setDepartment] = useState('전체');
  const [records, setRecords] = useState<WorkforceRecord[]>([]);
  const [loadedDate, setLoadedDate] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<WorkforceForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!canManage || !date) return;
    setError('');
    setNotice('');
    return onSnapshot(query(collection(db, 'workforce_records'), where('date', '==', date)), snapshot => {
      setRecords(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as WorkforceRecord)
        .sort((a, b) => a.department.localeCompare(b.department, 'ko') || a.name.localeCompare(b.name, 'ko')));
      setLoadedDate(date);
    }, () => {
      setError('인원 정보를 불러오지 못했습니다. 접근 권한과 네트워크 연결을 확인해 주세요.');
      setRecords([]);
      setLoadedDate('');
    });
  }, [canManage, date]);

  useEffect(() => {
    if (!form) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setForm(null);
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [form, busy]);

  useEffect(() => {
    if (!form) returnFocusRef.current?.focus();
  }, [form]);

  if (!canManage) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8"><h2 className="text-2xl font-black">인원관리</h2><p className="mt-3 text-sm text-slate-500">관리자 계정으로 인원배치, 효율, 근태를 관리할 수 있습니다.</p></div>;
  }

  const loading = loadedDate !== date;
  const visibleRecords = loading ? [] : records.filter(item => department === '전체' || item.department === department);
  const plannedHours = visibleRecords.reduce((sum, item) => sum + item.plannedHours, 0);
  const actualHours = visibleRecords.reduce((sum, item) => sum + item.actualHours, 0);
  const presentCount = visibleRecords.filter(item => ['출근', '지각', '조퇴', '반차'].includes(item.attendance)).length;
  const measured = visibleRecords.filter(item => item.target > 0);
  const achievedCount = measured.filter(item => item.completed >= item.target).length;

  const openForm = (item?: WorkforceRecord) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setError('');
    setNotice('');
    setEditingId(item?.id || null);
    setDraftId(doc(collection(db, 'workforce_records')).id);
    setForm(item ? {
      name: item.name, department: item.department, task: item.task, shift: item.shift,
      plannedHours: String(item.plannedHours), actualHours: String(item.actualHours),
      target: String(item.target), completed: String(item.completed), unit: item.unit,
      attendance: item.attendance, checkIn: item.checkIn, checkOut: item.checkOut,
      overtime: String(item.overtime), notes: item.notes,
    } : { ...emptyForm, department: department === '전체' ? '재고' : department as WorkforceForm['department'] });
  };

  const updateForm = (key: keyof WorkforceForm, value: string) => {
    setForm(current => current ? { ...current, [key]: value } : null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || busy) return;
    const hours = [form.plannedHours, form.actualHours, form.overtime].map(Number);
    const quantities = [form.target, form.completed].map(Number);
    if (!form.name.trim() || !form.unit.trim() || !date || [...hours, ...quantities].some(value => !Number.isFinite(value) || value < 0) || hours.some(value => value > 24) || hours[2] > hours[1]) {
      setError('이름과 날짜를 입력하고, 시간은 0~24시간, 수량은 0 이상으로 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ref = doc(db, 'workforce_records', editingId || draftId);
      await setDoc(ref, {
        ...form, name: form.name.trim(), date,
        plannedHours: hours[0], actualHours: hours[1], overtime: hours[2],
        target: quantities[0], completed: quantities[1], unit: form.unit.trim(),
        updatedAt: serverTimestamp(), ...(!editingId ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true });
      setForm(null);
      setNotice('인원 기록을 저장했습니다.');
    } catch {
      setError('저장하지 못했습니다. 입력 내용은 유지됩니다. 접근 권한과 연결을 확인하고 다시 저장해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: WorkforceRecord) => {
    if (busy || !window.confirm(`${item.date} ${item.name}님의 인원 기록을 삭제할까요?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'workforce_records', item.id));
      setNotice('인원 기록을 삭제했습니다.');
    } catch {
      setError('삭제하지 못했습니다. 접근 권한과 네트워크 연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-black tracking-widest text-slate-400">재고 · 물류 · 생산</p><h2 className="mt-2 text-3xl font-black text-slate-900">인원관리</h2><p className="mt-2 text-sm text-slate-500">부서별 인원배치와 작업 실적, 일별 근태를 관리합니다.</p></div>
        <button type="button" onClick={() => openForm()} disabled={loading || busy || !date} className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-40"><Plus size={18} />인원 기록 추가</button>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2" role="tablist" aria-label="인원관리 세부항목">
        {tabs.map(item => <button key={item.id} id={`workforce-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls="workforce-panel" onClick={() => setTab(item.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${tab === item.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}><item.icon size={18} />{item.label}</button>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '배치 인원', value: `${visibleRecords.length}명` },
          { label: '출근 인원', value: `${presentCount}명` },
          { label: '실근무 / 계획', value: `${numberFormat.format(actualHours)} / ${numberFormat.format(plannedHours)}시간` },
          { label: '목표 달성 기록', value: `${achievedCount} / ${measured.length}건` },
        ].map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-3 text-xl font-black text-slate-900">{loading ? '—' : item.value}</p></div>)}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <Field label="기준일"><input aria-label="기준일" type="date" required value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} className={inputClass} /></Field>
        <Field label="부서"><select aria-label="부서 필터" value={department} onChange={event => setDepartment(event.target.value)} className={inputClass}>{['전체', ...departments].map(item => <option key={item}>{item}</option>)}</select></Field>
        <p className="pb-3 text-xs text-slate-500">직원 1명당 하루 1개 기록을 기준으로 입력해 주세요.</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}

      <section id="workforce-panel" role="tabpanel" aria-labelledby={`workforce-tab-${tab}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5"><h3 className="font-black text-slate-900">{tabs.find(item => item.id === tab)?.label} 내역</h3>{tab === 'efficiency' && <p className="mt-2 text-xs leading-relaxed text-slate-500">달성률 = 실적 ÷ 목표 × 100 · 시간당 처리량 = 실적 ÷ 실근무시간. 목표 또는 실근무시간이 0이면 해당 지표를 표시하지 않습니다.</p>}{tab === 'attendance' && <p className="mt-2 text-xs text-slate-500">출근 인원은 출근·지각·조퇴·반차 상태를 포함합니다. 실근무시간은 휴게시간을 제외해 입력합니다.</p>}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr>
              {['이름', '부서', ...(tab === 'assignment' ? ['담당 업무', '근무조', '계획시간', '근태'] : tab === 'efficiency' ? ['목표', '실적', '실근무', '달성률', '시간당 처리량'] : ['상태', '출근', '퇴근', '실근무', '연장근무']), '관리'].map(label => <th key={label} className="whitespace-nowrap px-4 py-4 font-bold">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRecords.map(item => <tr key={item.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-4 font-bold">{item.name}</td><td className="px-4 py-4">{item.department}</td>
                {tab === 'assignment' && <><td className="max-w-64 break-words px-4 py-4">{item.task || '—'}</td><td className="px-4 py-4">{item.shift || '—'}</td><td className="px-4 py-4">{numberFormat.format(item.plannedHours)}시간</td><td className="px-4 py-4">{item.attendance}</td></>}
                {tab === 'efficiency' && <><td className="px-4 py-4">{numberFormat.format(item.target)} {item.unit}</td><td className="px-4 py-4">{numberFormat.format(item.completed)} {item.unit}</td><td className="px-4 py-4">{numberFormat.format(item.actualHours)}시간</td><td className="px-4 py-4 font-bold text-primary">{item.target > 0 ? `${numberFormat.format(item.completed / item.target * 100)}%` : '—'}</td><td className="px-4 py-4">{item.actualHours > 0 ? `${numberFormat.format(item.completed / item.actualHours)} ${item.unit}/시간` : '—'}</td></>}
                {tab === 'attendance' && <><td className="px-4 py-4">{item.attendance}</td><td className="px-4 py-4">{item.checkIn || '—'}</td><td className="px-4 py-4">{item.checkOut || '—'}</td><td className="px-4 py-4">{numberFormat.format(item.actualHours)}시간</td><td className="px-4 py-4">{numberFormat.format(item.overtime)}시간</td></>}
                <td className="px-4 py-4"><div className="flex gap-1"><button type="button" disabled={busy} onClick={() => openForm(item)} aria-label={`${item.name} 기록 수정`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button><button type="button" disabled={busy} onClick={() => remove(item)} aria-label={`${item.name} 기록 삭제`} className="rounded-lg p-2 text-red-400 hover:bg-red-50"><Trash2 size={16} /></button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {loading && !error && <p role="status" className="p-10 text-center text-sm text-slate-500">인원 정보를 불러오는 중입니다.</p>}
        {!loading && visibleRecords.length === 0 && <div className="p-12 text-center text-slate-400"><ClipboardList className="mx-auto mb-3" size={32} /><p className="text-sm">선택한 날짜와 부서에 등록된 인원 기록이 없습니다.</p></div>}
      </section>

      {form && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => { if (!busy) setForm(null); }}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="workforce-form-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="mb-5 flex items-start justify-between"><div><h3 id="workforce-form-title" className="text-xl font-black">{editingId ? '인원 기록 수정' : '인원 기록 추가'}</h3><p className="mt-1 text-sm text-slate-500">{date} · 인원배치, 효율, 근태에 함께 반영됩니다.</p></div><button aria-label="닫기" disabled={busy} onClick={() => setForm(null)} className="rounded-xl p-2 hover:bg-slate-100"><X size={20} /></button></div>
          <form onSubmit={save} className="space-y-6">
            <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="이름"><input autoFocus required maxLength={80} value={form.name} onChange={event => updateForm('name', event.target.value)} className={inputClass} /></Field>
                <Field label="배치 부서"><select value={form.department} onChange={event => updateForm('department', event.target.value)} className={inputClass}>{departments.map(item => <option key={item}>{item}</option>)}</select></Field>
                <Field label="담당 업무"><input maxLength={200} placeholder="예. 재고 실사, 출고 검수, 포장" value={form.task} onChange={event => updateForm('task', event.target.value)} className={inputClass} /></Field>
                <Field label="근무조"><input maxLength={80} placeholder="예. 주간, 야간, A조" value={form.shift} onChange={event => updateForm('shift', event.target.value)} className={inputClass} /></Field>
              </div>
              <div><h4 className="mb-3 font-bold">효율</h4><div className="grid gap-4 sm:grid-cols-2">
                <Field label="계획 근무시간"><input type="number" required min="0" max="24" step="0.25" value={form.plannedHours} onChange={event => updateForm('plannedHours', event.target.value)} className={inputClass} /></Field>
                <Field label="실근무시간 (휴게 제외, 연장 포함)"><input type="number" required min="0" max="24" step="0.25" value={form.actualHours} onChange={event => updateForm('actualHours', event.target.value)} className={inputClass} /></Field>
                <Field label="목표 수량"><input type="number" required min="0" step="any" value={form.target} onChange={event => updateForm('target', event.target.value)} className={inputClass} /></Field>
                <Field label="실적 수량"><input type="number" required min="0" step="any" value={form.completed} onChange={event => updateForm('completed', event.target.value)} className={inputClass} /></Field>
                <Field label="처리 단위"><input required maxLength={20} placeholder="예. 건, kg, BOX" value={form.unit} onChange={event => updateForm('unit', event.target.value)} className={inputClass} /></Field>
              </div></div>
              <div><h4 className="mb-3 font-bold">근태</h4><div className="grid gap-4 sm:grid-cols-2">
                <Field label="근태 상태"><select value={form.attendance} onChange={event => updateForm('attendance', event.target.value)} className={inputClass}>{attendanceStatuses.map(item => <option key={item}>{item}</option>)}</select></Field>
                <Field label="연장근무시간 (실근무시간 중)"><input type="number" required min="0" max={form.actualHours || '0'} step="0.25" value={form.overtime} onChange={event => updateForm('overtime', event.target.value)} className={inputClass} /></Field>
                <Field label="출근 시각"><input type="time" value={form.checkIn} onChange={event => updateForm('checkIn', event.target.value)} className={inputClass} /></Field>
                <Field label="퇴근 시각 (야간 근무는 다음 날 가능)"><input type="time" value={form.checkOut} onChange={event => updateForm('checkOut', event.target.value)} className={inputClass} /></Field>
              </div></div>
              <Field label="비고"><textarea maxLength={1000} rows={3} value={form.notes} onChange={event => updateForm('notes', event.target.value)} className={inputClass} /></Field>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setForm(null)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">취소</button><button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? '저장 중…' : '저장'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
