'use client';

import { useState, useRef } from 'react';
import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { FolderOpen, Plus, Download, Trash2, Upload } from 'lucide-react';
import { notify } from '@/lib/toast';

const CATEGORIAS = ['KYC', 'PLD', 'Contrato', 'Otro'];

type Plantilla = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  nombre_archivo: string;
  created_at: string;
};

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('KYC');
  const [descripcion, setDescripcion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!nombre.trim() || !file) {
      notify.error('Nombre y archivo son obligatorios.');
      return;
    }
    if (!['KYC', 'PLD', 'Contrato', 'Otro'].includes(categoria)) {
      notify.error('Categoría inválida.');
      return;
    }
    setSaving(true);
    try {
      await templatesApi.upload(file, nombre.trim(), categoria, descripcion.trim());
      notify.success('Plantilla subida correctamente.');
      onUploaded();
      onClose();
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Subir plantilla</div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="input-label">Nombre *</label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Formato KYC" />
          </div>
          <div>
            <label className="input-label">Categoría *</label>
            <select className="select" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Descripción</label>
            <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="input-label">Archivo (PDF) *</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <button className="btn btn-primary" disabled={saving} onClick={submit} style={{ marginTop: 4 }}>
            <Upload size={14} /> {saving ? 'Subiendo...' : 'Subir plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage = ['Super Admin', 'Admin'].includes(user?.role ?? '');

  const { data: templates = [], isLoading } = useQuery<Plantilla[]>({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });

  const download = async (id: string) => {
    const { data } = await templatesApi.getDownloadUrl(id);
    const url = data?.data?.signedUrl ?? data?.signedUrl;
    if (url) window.open(url, '_blank');
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    setDeletingId(id);
    try {
      await templatesApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      notify.success('Plantilla eliminada.');
    } finally {
      setDeletingId(null);
    }
  };

  const grouped = CATEGORIAS.map(cat => ({
    categoria: cat,
    items: templates.filter(t => t.categoria === cat),
  })).filter(g => g.items.length > 0 || true);

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Plantillas y Contratos</h1>
            <p className="page-desc">Formatos descargables (KYC, PLD, contratos) disponibles para todo el equipo</p>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Plus size={15} /> Subir Plantilla
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={32} />
            <p>No hay plantillas registradas todavía.</p>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                Subir la primera plantilla
              </button>
            )}
          </div>
        ) : (
          grouped.filter(g => g.items.length > 0).map(g => (
            <div key={g.categoria} className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--color-primary)', marginBottom: 10 }}>{g.categoria}</div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Descripción</th>
                      <th>Subido</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontSize: 13 }}>{t.nombre}</td>
                        <td style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>{t.descripcion || '—'}</td>
                        <td style={{ fontSize: 12 }}>{formatDate(t.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost" onClick={() => download(t.id)} title="Descargar">
                              <Download size={14} />
                            </button>
                            {canManage && (
                              <button
                                className="btn btn-ghost"
                                onClick={() => remove(t.id)}
                                disabled={deletingId === t.id}
                                title="Eliminar"
                                style={{ color: 'var(--color-error)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: ['templates'] })}
        />
      )}
    </>
  );
}
