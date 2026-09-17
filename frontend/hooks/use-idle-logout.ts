'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { notify } from '@/lib/toast';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
const CHECK_INTERVAL_MS = 15 * 1000;
const LAST_ACTIVITY_KEY = 'idea-uno-last-activity';
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Cierra la sesión tras 30 min sin actividad del usuario (no de tráfico API:
 * el interceptor de axios renueva el access token en silencio con cada
 * request, así que sin esto la sesión nunca expiraba mientras el refresh
 * token siguiera vigente). Se guarda en localStorage para que el timeout
 * sobreviva recargas y se comparta entre pestañas del mismo origen.
 */
export function useIdleLogout() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityRef.current));
    };
    markActivity();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const interval = setInterval(() => {
      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? lastActivityRef.current);
      if (Date.now() - stored >= IDLE_TIMEOUT_MS) {
        useAuthStore.getState().logout();
        notify.info('Tu sesión se cerró por inactividad.');
        router.replace('/login');
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated, router]);
}
