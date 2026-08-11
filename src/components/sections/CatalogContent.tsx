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
  CheckSquare,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  KeyRound,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  Upload,
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

type R2Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
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

const R2_BUCKET = 'min';
const R2_ENDPOINT = 'https://8418799974abc85a9fb5a6640cbc817d.r2.cloudflarestorage.com';
const PUBLIC_R2_BASE_URL = 'https://pub-66a5e554e66249ae92cdbbe7d349b546.r2.dev';
const R2_STORAGE_KEY = 'ima_catalog_r2_credentials';

function sanitizeObjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'catalog-image';
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function toDateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function getSigningKey(secretAccessKey: string, dateStamp: string) {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

async function uploadToR2(file: File, objectKey: string, credentials: R2Credentials) {
  const endpoint = new URL(R2_ENDPOINT);
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalUri = `/${R2_BUCKET}/${encodedKey}`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${credentials.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '900',
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeQueryValue(key)}=${encodeQueryValue(value)}`)
    .join('&');
  const canonicalHeaders = [
    `host:${endpoint.host}`,
    '',
  ].join('\n');
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  const signingKey = await getSigningKey(credentials.secretAccessKey, dateStamp);
  const signature = toHex(await hmac(signingKey, stringToSign));
  const uploadUrl = `${R2_ENDPOINT}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (${response.status}) ${detail}`);
  }

  return `${PUBLIC_R2_BASE_URL}/${encodedKey}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function encodeObjectPath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join('/');
}

function normalizeCatalogImageUrl(url = '') {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const endpointHost = new URL(R2_ENDPOINT).host;
    const publicHost = new URL(PUBLIC_R2_BASE_URL).host;

    if (parsed.host === endpointHost || parsed.host === publicHost) {
      let objectPath = parsed.pathname.replace(/^\/+/, '');
      if (objectPath.startsWith(`${R2_BUCKET}/`)) {
        objectPath = objectPath.slice(R2_BUCKET.length + 1);
      }
      return `${PUBLIC_R2_BASE_URL}/${encodeObjectPath(objectPath)}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

function imageBox(url: string, label: string) {
  const imageUrl = normalizeCatalogImageUrl(url);
  if (!imageUrl) return `<div class="image-placeholder">${escapeHtml(label)}</div>`;
  return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" />`;
}

function catalogSheet(item: CatalogItem) {
  const rows = CATALOG_FIELDS.map(({ key, label }) => `
    <tr>
      <th><span>◆</span>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(item[key] || '-'))}</td>
    </tr>
  `).join('');

  return `
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
  `;
}

function catalogCover(items: CatalogItem[]) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return `
    <section class="cover-page">
      <div class="cover-mark">
        <img src="/sidebarlogo.png?v=20260715" alt="123 Food" />
      </div>
      <div class="cover-copy">
        <p class="cover-kicker">PRODUCT CATALOG</p>
        <h1>(주)123푸드</h1>
        <p class="cover-title">제품 카탈로그</p>
        <div class="cover-meta">
          <span>선택 상품 ${items.length}개</span>
          <span>${today}</span>
        </div>
      </div>
    </section>
  `;
}

function catalogDocument(items: CatalogItem[]) {
  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>IMA 카탈로그</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, "Malgun Gothic", sans-serif;
            color: #111827;
            background: #fff;
          }
          .cover-page {
            min-height: 183mm;
            display: grid;
            grid-template-columns: 44% 56%;
            align-items: center;
            border: 1px solid #d1d5db;
            background: linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #ecfdf5 100%);
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }
          .cover-mark {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            border-right: 1px solid #e5e7eb;
            padding: 36px;
          }
          .cover-mark img {
            width: 82%;
            max-height: 130mm;
            object-fit: contain;
          }
          .cover-copy {
            padding: 46px;
          }
          .cover-kicker {
            margin: 0 0 18px;
            font-size: 13px;
            font-weight: 900;
            color: #047857;
            letter-spacing: 0.22em;
          }
          .cover-copy h1 {
            margin: 0;
            font-size: 54px;
            line-height: 1;
            font-weight: 900;
            color: #111827;
            letter-spacing: 0;
          }
          .cover-title {
            margin: 16px 0 28px;
            font-size: 28px;
            font-weight: 900;
            color: #374151;
          }
          .cover-meta {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .cover-meta span {
            border: 1px solid #d1fae5;
            background: #ecfdf5;
            color: #047857;
            border-radius: 999px;
            padding: 9px 14px;
            font-size: 13px;
            font-weight: 900;
          }
          .sheet {
            width: 100%;
            border: 1px solid #9ca3af;
            page-break-after: always;
            break-after: page;
          }
          .sheet:last-child {
            page-break-after: auto;
            break-after: auto;
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
      <body>${catalogCover(items)}${items.map(catalogSheet).join('')}</body>
    </html>
  `;
}

function openPdfWindow(items: CatalogItem[]) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument || frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    alert('PDF 출력 화면을 만들 수 없습니다. 브라우저 설정을 확인해주세요.');
    return;
  }

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  frameWindow.onafterprint = cleanup;
  frameDocument.open();
  frameDocument.write(catalogDocument(items));
  frameDocument.close();

  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    cleanup();
  }, 350);
}

function CatalogContent({ canEditItems }: { canEditItems: boolean }) {
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState<CatalogForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<1 | 2 | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isR2Open, setIsR2Open] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [r2Credentials, setR2Credentials] = useState<R2Credentials>(() => {
    try {
      const saved = localStorage.getItem(R2_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { accessKeyId: '', secretAccessKey: '' };
    } catch {
      return { accessKeyId: '', secretAccessKey: '' };
    }
  });

  useEffect(() => {
    const q = query(collection(db, 'catalogs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCatalogs(snapshot.docs.map((catalogDoc) => {
        const data = catalogDoc.data() as CatalogItem;
        return {
          id: catalogDoc.id,
          ...data,
          imageUrl1: normalizeCatalogImageUrl(data.imageUrl1 || ''),
          imageUrl2: normalizeCatalogImageUrl(data.imageUrl2 || ''),
        };
      }) as CatalogItem[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'catalogs'));

    return () => unsubscribe();
  }, []);

  const filteredCatalogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return catalogs.filter((item) => {
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesKeyword = !keyword || [
        item.category,
        item.productName,
        item.foodType,
        item.origin,
        item.part,
        item.weightSpec,
      ].some((value) => value?.toLowerCase().includes(keyword));

      return matchesCategory && matchesKeyword;
    });
  }, [catalogs, search, categoryFilter]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(catalogs.map((item) => item.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  }, [catalogs]);

  const selectedItems = useMemo(
    () => catalogs.filter((item) => selectedIds.has(item.id)),
    [catalogs, selectedIds]
  );

  const allVisibleSelected = filteredCatalogs.length > 0 && filteredCatalogs.every((item) => selectedIds.has(item.id));

  const updateField = (key: keyof CatalogForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setUploadingSlot(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const catalogItemToForm = (item: CatalogItem): CatalogForm => ({
    category: item.category || '',
    productName: item.productName || '',
    foodType: item.foodType || '',
    origin: item.origin || '',
    part: item.part || '',
    weightSpec: item.weightSpec || '',
    certification: item.certification || '',
    storageMethod: item.storageMethod || '',
    shelfLife: item.shelfLife || '',
    imageUrl1: normalizeCatalogImageUrl(item.imageUrl1 || ''),
    imageUrl2: normalizeCatalogImageUrl(item.imageUrl2 || ''),
  });

  const openCopyModal = (item: CatalogItem) => {
    setEditingId(null);
    setForm(catalogItemToForm(item));
    setUploadingSlot(null);
    setIsFormOpen(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm(catalogItemToForm(item));
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const saveR2Credentials = () => {
    if (!r2Credentials.accessKeyId.trim() || !r2Credentials.secretAccessKey.trim()) {
      alert('R2 액세스 키와 비밀 액세스 키를 입력해주세요.');
      return;
    }

    localStorage.setItem(R2_STORAGE_KEY, JSON.stringify(r2Credentials));
    setIsR2Open(false);
    alert('R2 업로드 정보가 이 브라우저에 저장되었습니다.');
  };

  const handleUploadImage = async (slot: 1 | 2, file?: File) => {
    if (!file) return;
    if (!r2Credentials.accessKeyId.trim() || !r2Credentials.secretAccessKey.trim()) {
      alert('먼저 R2 업로드 정보를 저장해주세요.');
      setIsR2Open(true);
      return;
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const nameBase = sanitizeObjectName(`${form.category}-${form.productName}-${slot}`);
    const objectKey = `catalog/${Date.now()}-${nameBase}.${extension}`;

    setUploadingSlot(slot);
    try {
      const publicUrl = await uploadToR2(file, objectKey, r2Credentials);
      updateField(slot === 1 ? 'imageUrl1' : 'imageUrl2', publicUrl);
    } catch (error) {
      console.error(error);
      alert('R2 업로드에 실패했습니다. R2 버킷 CORS에서 이 사이트 Origin과 PUT 업로드를 허용했는지 확인해주세요.');
    } finally {
      setUploadingSlot(null);
    }
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
        imageUrl1: normalizeCatalogImageUrl(form.imageUrl1),
        imageUrl2: normalizeCatalogImageUrl(form.imageUrl2),
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
      closeFormModal();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'catalogs');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEditItems) return;
    if (!window.confirm('선택한 카탈로그를 삭제할까요?')) return;

    try {
      await deleteDoc(doc(db, 'catalogs', id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `catalogs/${id}`);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredCatalogs.forEach((item) => next.delete(item.id));
      } else {
        filteredCatalogs.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const requireSelection = () => {
    if (selectedItems.length === 0) {
      alert('PDF로 만들 상품을 먼저 체크해주세요.');
      return false;
    }
    return true;
  };

  const handleDownloadSelected = () => {
    if (!requireSelection()) return;
    openPdfWindow(selectedItems);
  };

  const handleShareSelected = async () => {
    if (!requireSelection()) return;

    const html = catalogDocument(selectedItems);
    const file = new File([html], 'ima-catalog.html', { type: 'text/html' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'IMA PDF 카탈로그',
        text: '체크한 상품으로 만든 카탈로그입니다. 열어서 PDF로 저장할 수 있습니다.',
        files: [file],
      });
      return;
    }

    openPdfWindow(selectedItems);
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

  const renderImagePreviewBox = (url: string, label: string, compact = false) => {
    const imageUrl = normalizeCatalogImageUrl(url);
    return (
      <button
        type="button"
        onClick={() => imageUrl && setPreviewImage({ url: imageUrl, label })}
        disabled={!imageUrl}
        className={`group relative w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center ${compact ? 'aspect-[4/3]' : 'aspect-[16/10]'} disabled:cursor-default`}
        title={imageUrl ? '이미지 미리보기' : '이미지 없음'}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={label}
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.classList.add('hidden');
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden px-3 text-center text-[11px] font-black text-rose-500">
              이미지를 불러오지 못했습니다
            </div>
            <div className="absolute inset-0 hidden items-center justify-center bg-slate-950/45 text-white group-hover:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black backdrop-blur">
                <Eye className="w-3.5 h-3.5" />
                미리보기
              </span>
            </div>
          </>
        ) : (
          <ImageIcon className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-slate-200`} />
        )}
      </button>
    );
  };

  const renderImageInput = (slot: 1 | 2) => {
    const key = slot === 1 ? 'imageUrl1' : 'imageUrl2';
    const imageUrl = normalizeCatalogImageUrl(form[key]);
    return (
      <div className="space-y-2">
        <span className="text-xs font-black text-slate-500 uppercase">사진 {slot}</span>
        <div className="flex gap-2">
          <input
            value={form[key]}
            onChange={(e) => updateField(key, e.target.value)}
            disabled={!canEditItems}
            placeholder={PUBLIC_R2_BASE_URL + '/catalog/item-' + slot + '.png'}
            className="min-w-0 flex-1 h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => imageUrl && setPreviewImage({ url: imageUrl, label: '사진 ' + slot })}
            disabled={!imageUrl}
            className="h-12 w-12 rounded-xl border border-slate-200 bg-white text-slate-500 inline-flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="이미지 미리보기"
          >
            <Eye className="w-4 h-4" />
          </button>
          <label className={`h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-black text-xs inline-flex items-center gap-2 cursor-pointer hover:bg-slate-100 ${!canEditItems || uploadingSlot ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {uploadingSlot === slot ? '업로드 중' : '업로드'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={!canEditItems || uploadingSlot !== null}
              onChange={(e) => {
                handleUploadImage(slot, e.target.files?.[0]);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 items-center">
          {renderImagePreviewBox(imageUrl, '사진 ' + slot, true)}
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-500">업로드 미리보기</p>
            <p className="mt-1 truncate text-[11px] font-bold text-slate-400">
              {imageUrl || '이미지를 업로드하거나 URL을 입력하면 여기에서 확인됩니다.'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">카탈로그</h2>
            <p className="text-sm font-bold text-slate-400 mt-1">상품 등록, R2 이미지 업로드, 선택 PDF 카탈로그 생성</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 sm:w-52"
          >
            <option value="">전체 카테고리</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setIsR2Open(true)}
          disabled={!canEditItems}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          <KeyRound className="w-4 h-4" />
          R2 액세스 키 설정
        </button>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canEditItems}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-white shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          카탈로그 상품 등록
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleAllVisible}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <CheckSquare className="w-4 h-4" />
              {allVisibleSelected ? '현재 목록 선택 해제' : '현재 목록 전체 선택'}
            </button>
            <span className="text-xs font-black text-slate-400">선택 {selectedItems.length}개 / 현재 {filteredCatalogs.length}개 / 전체 {catalogs.length}개</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadSelected}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-40"
              disabled={selectedItems.length === 0}
            >
              <Download className="w-4 h-4" />
              PDF/다운로드
            </button>
            <button
              type="button"
              onClick={handleShareSelected}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              disabled={selectedItems.length === 0}
            >
              <Share2 className="w-4 h-4" />
              PDF/공유하기
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredCatalogs.map((item) => {
            const checked = selectedIds.has(item.id);
            return (
              <article key={item.id} className={`grid grid-cols-1 gap-4 p-4 transition lg:grid-cols-[40px_180px_minmax(0,1fr)_auto] lg:items-center ${checked ? 'bg-primary/5' : 'bg-white'}`}>
                <label className="flex items-center gap-3 lg:justify-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(item.id)}
                    className="h-5 w-5 rounded border-slate-300 text-primary"
                  />
                  <span className="text-xs font-black text-slate-400 lg:hidden">선택</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {[item.imageUrl1, item.imageUrl2].map((url, index) => (
                    <div key={index}>
                      {renderImagePreviewBox(url, `${item.productName || '카탈로그'} ${index + 1}`, true)}
                    </div>
                  ))}
                </div>

                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs font-black text-emerald-600 truncate">{item.category || '-'}</p>
                    <h3 className="text-lg font-black text-slate-900 truncate">{item.productName || '-'}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {CATALOG_FIELDS.slice(0, 4).map(({ key, label }) => (
                      <div key={key} className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-black text-slate-400">{label}</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{item[key] || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {canEditItems && (
                    <>
                      <button
                        type="button"
                        onClick={() => openCopyModal(item)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        <Copy className="w-4 h-4" />
                        복사
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
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
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {filteredCatalogs.length === 0 && (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 mx-auto text-slate-200" />
            <p className="mt-4 text-sm font-black text-slate-400">등록된 카탈로그 상품이 없습니다.</p>
          </div>
        )}
      </section>

      {isR2Open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">R2 이미지 업로드 설정</h3>
                  <p className="text-xs font-bold text-slate-400">버킷 {R2_BUCKET} / 이 브라우저에만 저장됩니다.</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsR2Open(false)} className="p-2 rounded-xl hover:bg-slate-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="space-y-2 block">
                <span className="text-xs font-black text-slate-500 uppercase">R2 액세스 키</span>
                <input
                  value={r2Credentials.accessKeyId}
                  onChange={(e) => setR2Credentials((prev) => ({ ...prev, accessKeyId: e.target.value }))}
                  disabled={!canEditItems}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-slate-50"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-xs font-black text-slate-500 uppercase">R2 비밀 액세스 키</span>
                <input
                  type="password"
                  value={r2Credentials.secretAccessKey}
                  onChange={(e) => setR2Credentials((prev) => ({ ...prev, secretAccessKey: e.target.value }))}
                  disabled={!canEditItems}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-slate-50"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
              <button type="button" onClick={() => setIsR2Open(false)} className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-black text-slate-600">
                닫기
              </button>
              <button type="button" onClick={saveR2Credentials} disabled={!canEditItems} className="h-11 px-5 rounded-xl bg-slate-900 text-sm font-black text-white disabled:opacity-40">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{editingId ? '카탈로그 상품 수정' : '카탈로그 상품 등록'}</h3>
                  <p className="text-xs font-bold text-slate-400">정보 입력 후 저장하면 Firestore에 등록됩니다.</p>
                </div>
              </div>
              <button type="button" onClick={closeFormModal} className="p-2 rounded-xl hover:bg-slate-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
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
                {renderImageInput(1)}
                {renderImageInput(2)}
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-5">
              <button type="button" onClick={closeFormModal} className="h-12 px-5 rounded-xl border border-slate-200 text-sm font-black text-slate-600">
                취소
              </button>
              <button
                type="submit"
                disabled={!canEditItems || saving}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                {saving ? '저장 중' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="text-base font-black text-slate-900">이미지 미리보기</h3>
                <p className="mt-0.5 max-w-[70vw] truncate text-xs font-bold text-slate-400">{previewImage.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  새 탭
                </a>
                <button type="button" onClick={() => setPreviewImage(null)} className="p-2 rounded-xl hover:bg-slate-50">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center bg-slate-100 p-4">
              <img
                src={previewImage.url}
                alt={previewImage.label}
                className="max-h-[72vh] max-w-full rounded-xl object-contain bg-white shadow-sm"
                onError={(e) => {
                  e.currentTarget.classList.add('hidden');
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden rounded-xl bg-white p-8 text-center shadow-sm">
                <ImageIcon className="mx-auto h-10 w-10 text-rose-300" />
                <p className="mt-3 text-sm font-black text-rose-500">이미지를 불러오지 못했습니다.</p>
                <p className="mt-1 max-w-lg break-all text-xs font-bold text-slate-400">{previewImage.url}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CatalogContent;
