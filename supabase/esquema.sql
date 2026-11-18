-- ARVENTA · Esquema de la base de datos (Supabase / PostgreSQL)
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run. Se puede correr más de una vez.
-- docs/REQUISITOS.md §3, §6 y §9.

-- ===== Estados de una solicitud: con esto se cobra la comisión y se arma el reporte =====
do $$ begin
  create type estado_solicitud as enum ('nueva', 'contactada', 'visita_agendada', 'visita_hecha', 'apartado', 'vendida', 'perdida');
exception when duplicate_object then null; end $$;

-- ===== Solicitudes de visita =====
create table if not exists public.solicitudes (
  id              bigint generated always as identity primary key,
  folio           text not null unique check (folio ~ '^V-[A-Z2-9]{6}$'),
  creado          timestamptz not null default now(),
  desarrollo      text not null,
  nombre          text not null check (length(nombre) between 2 and 80),
  telefono        text not null check (telefono ~ '^\d{10}$'),
  cuando          text not null,
  pago            text not null,
  trabajo_texto   text,
  trabajo_lat     numeric(5,2),          -- redondeado a ~1 km, nunca el punto exacto
  trabajo_lng     numeric(5,2),
  minutos         smallint,
  consentimiento  boolean not null check (consentimiento),
  version_aviso   text,
  ip_hash         text,                  -- huella de la IP (para el límite de 5 por hora), no la IP
  aviso_enviado   boolean not null default false,
  -- Seguimiento (lo llena ARVENTA en el editor de tablas)
  estado          estado_solicitud not null default 'nueva',
  registrado_con_desarrolladora timestamptz,  -- prueba de que ARVENTA llevó al cliente: protege la comisión
  actualizado     timestamptz not null default now(),
  notas           text
);
create index if not exists solicitudes_creado on public.solicitudes (creado desc);
create index if not exists solicitudes_ip on public.solicitudes (ip_hash, creado);
create index if not exists solicitudes_desarrollo on public.solicitudes (desarrollo, creado);

create or replace function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;
drop trigger if exists solicitudes_actualizado on public.solicitudes;
create trigger solicitudes_actualizado before update on public.solicitudes for each row execute function public.tocar_actualizado();

-- ===== Eventos anónimos (búsquedas, filtros, vistas, clics) =====
create table if not exists public.eventos (
  id          bigint generated always as identity primary key,
  creado      timestamptz not null default now(),
  tipo        text not null,
  desarrollo  text,
  datos       jsonb not null default '{}'::jsonb,
  pagina      text
);
create index if not exists eventos_creado on public.eventos (creado desc);
create index if not exists eventos_tipo on public.eventos (tipo, desarrollo, creado);

-- ===== Desarrolladoras que quieren anunciarse =====
create table if not exists public.contactos (
  id          bigint generated always as identity primary key,
  folio       text not null unique,
  creado      timestamptz not null default now(),
  nombre text not null, empresa text, desarrollo text not null, ubicacion text, tipo text,
  unidades text, precio text, telefono text, correo text, mensaje text, ip_hash text,
  estado      text not null default 'nuevo'
);

-- ===== Reglas de acceso (RLS) =====
-- Las funciones de /api usan la llave de servicio (solo vive en Vercel). El público, con la llave anónima,
-- no puede leer, cambiar ni borrar nada; tampoco insertar directo: todo entra validado por /api.
alter table public.solicitudes enable row level security;
alter table public.eventos     enable row level security;
alter table public.contactos   enable row level security;
revoke all on public.solicitudes, public.eventos, public.contactos from anon, authenticated;

-- ===== Plazo de guardado (aviso de privacidad) =====
-- Solicitudes sin compra se borran a los 12 meses; los eventos anónimos, a los 24.
create or replace function public.borrar_vencidos() returns void language sql security definer as $$
  delete from public.solicitudes where creado < now() - interval '12 months' and estado not in ('apartado', 'vendida');
  delete from public.contactos   where creado < now() - interval '24 months';
  delete from public.eventos     where creado < now() - interval '24 months';
$$;
-- Programar cada día a las 3:00 (Supabase → Database → Extensions → activa pg_cron primero)
do $$ begin
  perform cron.schedule('arventa-borrar-vencidos', '0 9 * * *', 'select public.borrar_vencidos()');
exception when others then raise notice 'Activa la extensión pg_cron y vuelve a correr este archivo para programar el borrado.';
end $$;

-- ===== Vista para el seguimiento diario =====
create or replace view public.pendientes as
  select folio, creado, desarrollo, nombre, telefono, cuando, pago, estado, registrado_con_desarrolladora
  from public.solicitudes where estado in ('nueva', 'contactada', 'visita_agendada') order by creado;
revoke all on public.pendientes from anon, authenticated;
