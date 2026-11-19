-- ARVENTA · Esquema de la base de datos (Supabase / PostgreSQL)
-- Cómo usarlo: Supabase → Database → Extensions → activa pg_cron; luego SQL Editor → pega todo → Run.
-- Se puede correr más de una vez. docs/REQUISITOS.md §3, §6 y §9.

-- ===== Estados de una solicitud (lo que se factura al anunciante) =====
--   nueva          llegó la solicitud; se le manda al cliente su enlace de verificación por WhatsApp
--   verificada     el cliente tocó "Confirmo mi visita" desde su WhatsApp
--   enviada        ARVENTA se la mandó por WhatsApp a quien comercializa el desarrollo (esto se cobra)
--   visita_hecha   el cliente tocó "Ya llegué" a menos de 300 m, o ARVENTA lo marcó
--   invalida       con motivo (teléfono falso, duplicada, cliente previo con prueba de 60 días); no se cobra
do $$ begin
  create type estado_solicitud as enum ('nueva', 'verificada', 'enviada', 'visita_hecha', 'invalida');
exception when duplicate_object then null; end $$;
do $$ begin
  create type motivo_invalida as enum ('telefono_falso', 'duplicada', 'cliente_previo', 'otro');
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
  presupuesto     numeric(12,0),          -- el tope que calculó o eligió, si lo hizo
  mensualidad     numeric(10,0),          -- la que vio en la calculadora de la ficha
  otros           text[],                 -- otros desarrollos que guardó o comparó (ids)
  trabajo_texto   text,
  trabajo_lat     numeric(5,2),           -- redondeado a ~1 km, nunca el punto exacto
  trabajo_lng     numeric(5,2),
  minutos         smallint,
  consentimiento  boolean not null check (consentimiento),
  version_aviso   text,
  ip_hash         text,                   -- huella de la IP (límite de 5 por hora), no la IP
  token           text not null,          -- enlace personal del cliente (/cita/?c=FOLIO&t=TOKEN)
  duplicada_de    text,                   -- mismo teléfono y desarrollo en los últimos 60 días
  aviso_enviado   boolean not null default false,   -- te llegó el aviso por WhatsApp
  estado          estado_solicitud not null default 'nueva',
  verificacion_enviada_en timestamptz,    -- salió el WhatsApp de verificación al cliente
  verificada_en   timestamptz,            -- el cliente confirmó: prueba de que la cita es real
  enviada_en      timestamptz,            -- se mandó a la desarrolladora: prueba para cobrar
  enviada_a       text,                   -- a qué WhatsApp de la desarrolladora
  cita_fecha      timestamptz,            -- día y hora acordados
  llegada_en      timestamptz,            -- "Ya llegué" verificado (solo la distancia, nunca la ubicación)
  llegada_distancia_m integer,
  motivo_invalida motivo_invalida,
  detalle_invalida text,
  prueba_fecha    date,                   -- cliente previo: fecha de la prueba (60 días antes de la solicitud)
  actualizado     timestamptz not null default now(),
  notas           text
);
create index if not exists solicitudes_creado on public.solicitudes (creado desc);
create index if not exists solicitudes_ip on public.solicitudes (ip_hash, creado);
create index if not exists solicitudes_desarrollo on public.solicitudes (desarrollo, creado);
create index if not exists solicitudes_tel on public.solicitudes (telefono, desarrollo, creado);

create or replace function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;
drop trigger if exists solicitudes_actualizado on public.solicitudes;
create trigger solicitudes_actualizado before update on public.solicitudes for each row execute function public.tocar_actualizado();

-- ===== A quién se le manda cada cita (WhatsApp del asesor de cada desarrolladora) =====
-- Ejemplo: insert into desarrolladoras (nombre, whatsapp, desarrollos) values ('Desarrolladora X', '6181234567', array['cienega-2']);
create table if not exists public.desarrolladoras (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  whatsapp    text not null check (whatsapp ~ '^\d{10}$'),
  desarrollos text[] not null,
  activa      boolean not null default true
);

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

-- ===== Cotizaciones (corrida financiera). Sin nombre: el nombre solo va en el PDF del cliente =====
create table if not exists public.cotizaciones (
  id          bigint generated always as identity primary key,
  codigo      text not null unique check (codigo ~ '^C-[A-Z2-9]{6}$'),
  creado      timestamptz not null default now(),
  folio       text references public.solicitudes(folio) on delete set null,
  desarrollo  text not null,
  esquema     text not null,
  origen      text not null default 'sitio' check (origen in ('sitio', 'oficina')),
  precio      numeric(12,2) not null,
  enganche    numeric(12,2) not null,
  meses       smallint not null,
  credito     text not null,
  datos       jsonb not null default '{}'::jsonb
);
create index if not exists cotizaciones_desarrollo on public.cotizaciones (desarrollo, creado);

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
-- Solo las funciones de /api (con la llave de servicio, que vive en Vercel) leen y escriben.
-- El público, con la llave anónima, no puede hacer nada: todo entra validado por /api.
alter table public.solicitudes     enable row level security;
alter table public.desarrolladoras enable row level security;
alter table public.eventos         enable row level security;
alter table public.cotizaciones    enable row level security;
alter table public.contactos       enable row level security;
revoke all on public.solicitudes, public.desarrolladoras, public.eventos, public.cotizaciones, public.contactos from anon, authenticated;

-- ===== Lo que se factura: citas verificadas que se enviaron, sin repetir ni invalidar =====
create or replace view public.citas_cobrables as
  select s.folio, s.desarrollo, s.creado, s.verificada_en, s.enviada_en, s.enviada_a, s.llegada_en, s.llegada_distancia_m
  from public.solicitudes s
  where s.verificada_en is not null and s.enviada_en is not null and s.estado <> 'invalida' and s.duplicada_de is null;
revoke all on public.citas_cobrables from anon, authenticated;

-- ===== Plazo de guardado (aviso de privacidad) =====
-- Solicitudes: 12 meses (las enviadas se conservan 24 para la facturación); eventos y contactos: 24.
create or replace function public.borrar_vencidos() returns void language sql security definer as $$
  delete from public.solicitudes where (creado < now() - interval '12 months' and enviada_en is null) or creado < now() - interval '24 months';
  delete from public.contactos   where creado < now() - interval '24 months';
  delete from public.eventos     where creado < now() - interval '24 months';
$$;
do $$ begin
  perform cron.schedule('arventa-borrar-vencidos', '0 9 * * *', 'select public.borrar_vencidos()');
exception when others then raise notice 'Activa la extensión pg_cron y vuelve a correr este archivo para programar el borrado.';
end $$;
