// lib/api.ts
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { notify } from '@/lib/toast';
import { getApiErrorMessage } from '@/lib/validators';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh?.startsWith('mock-')) return Promise.reject(error);
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${API_URL}/auth/refresh`,
            null,
            { headers: { Authorization: `Bearer ${refresh}` } },
          );
          localStorage.setItem('access_token', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api.request(error.config);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    // Toast flotante automático para cualquier error de API (salvo 401 y opt-out).
    const status = error.response?.status;
    const skip = (error.config as { skipErrorToast?: boolean } | undefined)?.skipErrorToast;
    if (status !== 401 && !skip && typeof window !== 'undefined') {
      notify.error(getApiErrorMessage(error));
    }

    return Promise.reject(error);
  }
);

// AUTH
export const authApi = {
  // Login maneja su propio error inline; evitamos el toast global duplicado.
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }, { skipErrorToast: true } as never),
  register: (data: Record<string, unknown>) => api.post('/auth/register', data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', null, { headers: { Authorization: `Bearer ${refreshToken}` } }),
  getMe: () => api.get('/auth/me'),
};

// DASHBOARD
export interface DashboardFilters {
  fechaInicio?: string;
  fechaFin?: string;
  idAsesor?: string;
  tipoOperacion?: string;
  estatusCierre?: string;
}

export const dashboardApi = {
  getKpis: (params?: DashboardFilters) => api.get('/dashboard/kpis', { params }),
  getCharts: (params?: DashboardFilters) => api.get('/dashboard/charts', { params }),
  getComisionPorMes: (params?: DashboardFilters) =>
    api.get('/dashboard/comision-por-mes', { params }),
  getAdvisorStats: (advisorId?: string) =>
    api.get('/dashboard/advisor', { params: advisorId ? { advisorId } : undefined }),
  getConfig: () => api.get('/dashboard/config'),
  updateConfig: (id: string, valorNumerico: number, actualizadoPor?: string) =>
    api.patch(`/dashboard/config/${id}`, { valorNumerico, actualizadoPor }),
};

// PROPERTIES
export const propertiesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/properties', { params }),
  getOne: (id: string) => api.get(`/properties/${id}`),
  create: (data: Record<string, unknown>) => api.post('/properties', data),
  saveCopropietarios: (
    id: string,
    copropietarios: { nombre?: string; orden: number; documentoIneId?: string }[],
  ) => api.post(`/properties/${id}/copropietarios`, { copropietarios }),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/properties/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/properties/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/properties/${id}`),
};

// CONTRACTS
export const contractsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/contracts', { params }),
  getOne: (id: string) => api.get(`/contracts/${id}`),
  create: (data: Record<string, unknown>) => api.post('/contracts', data),
  updateStatus: (id: string, estatus: string, observaciones?: string) =>
    api.patch(`/contracts/${id}/status`, { estatus, observaciones }),
};

// PAYMENTS
export const paymentsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/payments', { params }),
  getOne: (id: string) => api.get(`/payments/${id}`),
  request: (commissionId: string, advisorId: string) =>
    api.post('/payments/request', { commissionId, advisorId }),
  authorize: (id: string) => api.patch(`/payments/${id}/authorize`, {}),
  markPaid: (
    id: string,
    formaPago: string,
    montoPagado: number,
    opts?: { requiereCfdi?: boolean; uuidCfdi?: string; referenciaTransferencia?: string },
  ) =>
    api.patch(`/payments/${id}/paid`, {
      formaPago,
      montoPagado,
      requiereCfdi: opts?.requiereCfdi,
      uuidCfdi: opts?.uuidCfdi,
      referenciaTransferencia: opts?.referenciaTransferencia,
    }),
  reject: (id: string, observaciones?: string) =>
    api.patch(`/payments/${id}/reject`, { observaciones }),
};

// COMPLIANCE
export const complianceApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/compliance/cases', { params }),
  getOne: (id: string) => api.get(`/compliance/cases/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/compliance/cases/${id}`, data),
};

// CLIENTS
export const clientsApi = {
  getAll: (params?: { search?: string; type?: string; page?: number; limit?: number }) =>
    api.get('/clients', { params }),
  getOne: (id: string) => api.get(`/clients/${id}`),
  create: (data: Record<string, unknown>) => api.post('/clients', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/clients/${id}`, data),
};

// AUDIT
export const auditApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/audit', { params }),
};

// NOTIFICATIONS (bandeja in-app del asesor)
export const notificationsApi = {
  getAll: (limit = 20) => api.get('/notifications', { params: { limit } }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`, {}),
  markAllRead: () => api.patch('/notifications/read-all', {}),
};

// ADVISORS
export const advisorsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/advisors', { params }),
  getOne: (id: string) => api.get(`/advisors/${id}`),
  create: (data: Record<string, unknown>) => api.post('/advisors', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/advisors/${id}`, data),
  updateStatus: (id: string, status: string, motivo_baja?: string, fecha_baja?: string) =>
    api.patch(`/advisors/${id}/status`, { status, motivo_baja, fecha_baja }),
  updateBank: (id: string, clabe_interbancaria: string, banco: string, titular_cuenta: string) =>
    api.patch(`/advisors/${id}/bank`, { clabe_interbancaria, banco, titular_cuenta }),
};

// TEAMS (alta de asesores en modo team)
export const teamsApi = {
  create: (data: Record<string, unknown>) => api.post('/teams', data),
  addMember: (teamId: string, data: Record<string, unknown>) =>
    api.post(`/teams/${teamId}/members`, data),
  getOne: (id: string) => api.get(`/teams/${id}`),
  getDocumentosPendientes: (id: string) => api.get(`/teams/${id}/documentos-pendientes`),
};

// OPERATIONS (cierres)
export const operationsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/operations', { params }),
  getOne: (id: string) => api.get(`/operations/${id}`),
  create: (data: Record<string, unknown>) => api.post('/operations', data),
  updateStatus: (id: string, status: string) => api.patch(`/operations/${id}/status`, { status }),
  cancel: (id: string, motivo: string) => api.patch(`/operations/${id}/cancel`, { motivo }),
};

// COMMISSIONS
export const commissionsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/operations/commissions', { params }),
  release: (id: string) => api.patch(`/operations/commissions/${id}/release`, {}),
  block: (id: string, motivo: string) => api.patch(`/operations/commissions/${id}/block`, { motivo }),
  unblock: (id: string) => api.patch(`/operations/commissions/${id}/unblock`, {}),
};

// DOCUMENTS
export const documentsApi = {
  uploadFile: (file: File, entidad: string, idEntidad: string, tipoDocumento: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entidad', entidad);
    form.append('idEntidad', idEntidad);
    form.append('tipoDocumento', tipoDocumento);
    // Content-Type: undefined lets axios set multipart/form-data with boundary automatically
    return api.post('/documents/upload', form, { headers: { 'Content-Type': undefined } });
  },
  getSignedUrl: (id: string) => api.get(`/documents/${id}/url`),
  listByEntity: (entidad: string, idEntidad: string) =>
    api.get(`/documents/entity/${entidad}/${idEntidad}`),
  updateStatus: (id: string, status: string, observaciones?: string) =>
    api.patch(`/documents/${id}/status`, { status, observaciones }),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// TEMPLATES (Plantillas y Contratos)
export const templatesApi = {
  getAll: () => api.get('/templates'),
  getDownloadUrl: (id: string) => api.get(`/templates/${id}/url`),
  upload: (file: File, nombre: string, categoria: string, descripcion?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('nombre', nombre);
    form.append('categoria', categoria);
    form.append('descripcion', descripcion ?? '');
    return api.post('/templates', form, { headers: { 'Content-Type': undefined } });
  },
  delete: (id: string) => api.delete(`/templates/${id}`),
};

export async function uploadDocuments(
  files: Partial<Record<string, File>>,
  mapping: Record<string, string>,
  entidad: string,
  idEntidad: string,
): Promise<void> {
  const uploads = Object.entries(files)
    .filter((entry): entry is [string, File] => !!entry[1])
    .map(([key, file]) =>
      documentsApi.uploadFile(file, entidad, idEntidad, mapping[key] ?? key),
    );
  await Promise.all(uploads);
}
