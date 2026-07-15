import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import {
  BookOpen,
  Download,
  Edit,
  Image as ImageIcon,
  Plus,
  Save,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { handleFirestoreError } from '../../lib/firestoreUtils';
import { OperationType } from '../../types';

type CatalogForm = {
  category: string;
  productName: string;
  foodType: string;
  origin: string;
  part: string;
  weightSpec: string;
  certification: string;
  storageMethod: string;
  shelfLife: string;
  imageUrl1: string;
  imageUrl2: string;
};

type CatalogItem = CatalogForm & {
  id: string;
  createdAt?: any;
  updatedAt?: any;
};

const EMPTY_FORM: CatalogForm = {
  category: '',
  productName: '',
  foodType: '',
  origin: '',
  part: '',
  weightSpec: '',
  certification: '',
  storageMethod: '',
  shelfLife: '',
  imageUrl1: '',
  imageUrl2: '',
};

const CATALOG_FIELDS = [
  { key: 'foodType', label: '식품유형' },
  { key: 'origin', label: '원산지' },
  { key: 'part', label: '부위' },
  { key: 'weightSpec', label: '중량/규격' },
  { key: 'certification', label: '안전인증' },
  { key: 'storageMethod', label: '보관방법' },
  { key: 'shelfLife', label: '유통기한' },
] as const;

const PUBLIC_R2_BASE_URL = 'https://pub-66a5e554e66249ae92cdbbe7d349b546.r2.dev';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function imageBox(url: string, label: string) {
  if (!url) {
    return `<div class="image-placeholder">${label}</div>`;
  }
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" />`;
}

function exportCatalogPdf(item: CatalogItem) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert('팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.');
    return;
  }

  const rows = CATALOG_FIELDS.map(({ key, label }) => `
    <tr>
      <th><span>◆</span>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(item[key] || '-'))}</td>
    </tr>
  `).join('');

  win.document.write(`
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(item.productName || 'catalog')}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, "Malgun Gothic", sans-serif;
            color: #111827;
            background: #fff;
          }
          .sheet {
            width: 100%;
            border: 1px solid #9ca3af;
          }
          .title {
            padding: 8px 10px 10px;
            background: #f3f4f6;
            font-size: 31px;
            line-height: 1;
            font-weight: 900;
            color: #7c3f18;
            letter-spacing: 0;
          }
          .title span { color: #4a86d8; }
          .product {
            padding: 8px 18px;
            font-size: 21px;
            font-weight: 800;
            border-bottom: 1px dotted #9ca3af;
          }
          .content {
            display: grid;
            grid-template-columns: 62% 38%;
            min-height: 260px;
          }
          .photos {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-right: 1px dotted #6b7280;
          }
          .photo {
            min-height: 260px;
            border-right: 1px dotted #6b7280;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            overflow: hidden;
          }
          .photo:last-child { border-right: 0; }
          .photo img {
            width: 100%;
            height: 100%;
            max-height: 260px;
            object-fit: contain;
            display: block;
          }
          .image-placeholder {
            color: #9ca3af;
            font-size: 14px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 15px;
          }
          th, td {
            text-align: left;
            vertical-align: middle;
            border-bottom: 1px dotted #d6c7ad;
            padding: 8px 8px;
            height: 33px;
          }
          th {
            width: 34%;
            color: #bd8a4d;
            font-weight: 800;
            background: #fffdf9;
            white-space: nowrap;
          }
          th span {
            margin-right: 6px;
            color: #c9a26f;
          }
          td {
            color: #111827;
            line-height: 1.35;
          }
        </style>
      </head>
      <body>
        <section class="sheet">
          <div class="title">${escapeHtml(item.category || '카탈로그')} <span>(포장육)</span></div>
          <div class="product">${escapeHtml(item.productName || '-')}</div>
          <div class="content">
            <div class="photos">
              <div class="photo">${imageBox(item.imageUrl1, '이미지 1')}</div>
              <div class="photo">${imageBox(item.imageUrl2, '이미지 2')}</div>
            </div>
            <table>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

function CatalogContent({ canEditItems }: { canEditItems: boolean }) {
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState<CatalogForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'catalogs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCatalogs(snapshot.docs.map((catalogDoc) => ({
        id: catalogDoc.id,
        ...catalogDoc.data(),
      })) as CatalogItem[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'catalogs'));

    return () => unsubscribe();
  }, []);

  const filteredCatalogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return catalogs;

    return catalogs.filter((item) => [
      item.category,
      item.productName,
      item.foodType,
      item.origin,
      item.part,
      item.weightSpec,
    ].some((value) => value?.toLowerCase().includes(keyword)));
  }, [catalogs, search]);

  const updateField = (key: keyof CatalogForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditItems) return;

    if (!form.category.trim() || !form.productName.trim()) {
      alert('대분류와 제품명은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'catalogs', editingId), payload);
      } else {
        await addDoc(collection(db, 'catalogs'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'catalogs');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm({
      category: item.category || '',
      productName: item.productName || '',
      foodType: item.foodType || '',
      origin: item.origin || '',
      part: item.part || '',
      weightSpec: item.weightSpec || '',
      certification: item.certification || '',
      storageMethod: item.storageMethod || '',
      shelfLife: item.shelfLife || '',
      imageUrl1: item.imageUrl1 || '',
      imageUrl2: item.imageUrl2 || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!canEditItems) return;
    if (!window.confirm('선택한 카탈로그를 삭제할까요?')) return;

    try {
      await deleteDoc(doc(db, 'catalogs', id));
      if (editingId === id) resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `catalogs/${id}`);
    }
  };

  const renderInput = (key: keyof CatalogForm, label: string, placeholder = '') => (
    <label className="space-y-2">
      <span className="text-xs font-black text-slate-500 uppercase">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => updateField(key, e.target.value)}
        disabled={!canEditItems}
        placeholder={placeholder}
        className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-slate-50"
      />
    </label>
  );

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">카탈로그</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">제품 정보 등록 및 PDF Export</p>
            </div>
          </div>
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제품명, 원산지, 부위 검색"
            className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black text-slate-900">{editingId ? '카탈로그 수정' : '카탈로그 등록'}</h3>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
            >
              <X className="w-4 h-4" />
              취소
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {renderInput('category', '대분류', '소 부속물')}
          {renderInput('productName', '제품명', '곱대창')}
          {renderInput('foodType', '식품유형', '포장육')}
          {renderInput('origin', '원산지', '국내산')}
          {renderInput('part', '부위', '소곱창')}
          {renderInput('weightSpec', '중량/규격', '1kg')}
          {renderInput('certification', '안전인증', 'HACCP 인증')}
          {renderInput('storageMethod', '보관방법', '-18도 이하 냉동보관')}
          {renderInput('shelfLife', '유통기한', '제조일로부터 12개월')}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderInput('imageUrl1', '사진 1 URL', `${PUBLIC_R2_BASE_URL}/catalog/item-front.png`)}
          {renderInput('imageUrl2', '사진 2 URL', `${PUBLIC_R2_BASE_URL}/catalog/item-back.png`)}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canEditItems || saving}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-2xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredCatalogs.map((item) => {
          const images = [item.imageUrl1, item.imageUrl2].filter(Boolean);
          return (
            <article key={item.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-100">
                {[0, 1].map((index) => (
                  <div key={index} className="aspect-[4/3] bg-white border-r last:border-r-0 border-slate-100 flex items-center justify-center overflow-hidden">
                    {images[index] ? (
                      <img src={images[index]} alt={`${item.productName} ${index + 1}`} className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-200" />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-emerald-600">{item.category || '-'}</p>
                    <h3 className="text-xl font-black text-slate-900 mt-1">{item.productName || '-'}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportCatalogPdf(item)}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATALOG_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-[11px] font-black text-slate-400">{label}</span>
                      <span className="text-xs font-bold text-slate-800 text-right truncate">{item[key] || '-'}</span>
                    </div>
                  ))}
                </div>

                {canEditItems && (
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                    >
                      <Edit className="w-4 h-4" />
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-100 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {filteredCatalogs.length === 0 && (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-slate-200" />
          <p className="mt-4 text-sm font-black text-slate-400">등록된 카탈로그가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

export default CatalogContent;
