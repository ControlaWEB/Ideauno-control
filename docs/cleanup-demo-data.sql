-- Borra toda la data mock/demo insertada para pruebas del dashboard.
-- No toca advisors, usuarios, ni fact_ama_asesor (no se modificaron).
-- Ejecutar en orden (respeta FKs).

delete from public.fact_pagos where id like 'DEMO-%';
delete from public.commissions where id like 'DEMO-%';
delete from public.operations where id like 'DEMO-%';
delete from public.dim_documentos where id_entidad like 'DEMO-%';
delete from public.properties where id like 'DEMO-%';
delete from public.clients where id like 'DEMO-%';

-- Los archivos PDF subidos a Storage (bucket inmobiliaria-docs, paths
-- "propiedad/DEMO-PROP-*/contrato_comision/*.pdf") hay que borrarlos aparte
-- desde el dashboard de Supabase Storage o pidiéndomelo, el SQL no borra Storage.
