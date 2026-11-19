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

-- =====================================================================
-- Citas que valen sin depender del asesor (se puede correr sobre lo anterior)
-- =====================================================================
alter table public.solicitudes add column if not exists token text;                 -- enlace de confirmación (solo llega al WhatsApp del cliente)
alter table public.solicitudes add column if not exists cita_fecha timestamptz;      -- la acuerda ARVENTA con el cliente
alter table public.solicitudes add column if not exists confirmada_en timestamptz;   -- el cliente confirmó desde su enlace: ESTA es la cita que vale
alter table public.solicitudes add column if not exists llegada_en timestamptz;      -- el cliente tocó "Ya llegué" a menos de 300 m
alter table public.solicitudes add column if not exists llegada_distancia_m integer; -- solo la distancia; nunca su ubicación
alter table public.solicitudes add column if not exists duplicada_de text;           -- mismo teléfono y desarrollo en los últimos 60 días
create index if not exists solicitudes_tel on public.solicitudes (telefono, desarrollo, creado);

-- Cotizaciones (corrida financiera). Sin datos personales: el nombre solo va en el PDF del cliente.
create table if not exists public.cotizaciones (
  id          bigint generated always as identity primary key,
  codigo      text not null unique check (codigo ~ '^C-[A-Z2-9]{6}$'),
  creado      timestamptz not null default now(),
  folio       text references public.solicitudes(folio) on delete set null,  -- la cita a la que queda ligada
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

-- Desarrolladoras: su clave (guardada como huella SHA-256) y qué desarrollos son suyos.
-- Alta: insert into desarrolladoras (nombre, clave_hash, desarrollos)
--       values ('Desarrolladora X', encode(sha256('CLAVE-LARGA-AL-AZAR'::bytea), 'hex'), array['cienega-2']);
create table if not exists public.desarrolladoras (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  clave_hash  text not null unique,
  desarrollos text[] not null,
  activa      boolean not null default true
);

-- Reclamos del asesor: solo con motivo; ARVENTA revisa y decide. No cambian el cobro por sí solos.
create table if not exists public.reclamos (
  id               bigint generated always as identity primary key,
  creado           timestamptz not null default now(),
  folio            text not null references public.solicitudes(folio) on delete cascade,
  desarrolladora   bigint not null references public.desarrolladoras(id),
  motivo           text not null check (motivo in ('telefono_falso', 'duplicada', 'cliente_previo')),
  detalle          text not null,
  prueba_fecha     date,          -- cliente previo: fecha de la prueba (debe estar en los 60 días antes de la solicitud)
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
  resuelto_en      timestamptz,
  nota_resolucion  text
);

alter table public.cotizaciones    enable row level security;
alter table public.desarrolladoras enable row level security;
alter table public.reclamos        enable row level security;
revoke all on public.cotizaciones, public.desarrolladoras, public.reclamos from anon, authenticated;

-- Seguimiento: enlace que ARVENTA manda al cliente para confirmar
drop view if exists public.pendientes;
create view public.pendientes as
  select folio, creado, desarrollo, nombre, telefono, cuando, pago, estado, cita_fecha, confirmada_en, llegada_en, duplicada_de,
         'https://arventa.mx/cita/?c=' || folio || '&t=' || token as enlace_confirmacion
  from public.solicitudes where estado in ('nueva', 'contactada', 'visita_agendada') order by creado;
revoke all on public.pendientes from anon, authenticated;

-- Citas que se cobran: confirmadas por el cliente y sin reclamo aceptado
create or replace view public.citas_cobrables as
  select s.folio, s.desarrollo, s.creado, s.confirmada_en, s.llegada_en, s.llegada_distancia_m
  from public.solicitudes s
  where s.confirmada_en is not null and s.duplicada_de is null
    and not exists (select 1 from public.reclamos r where r.folio = s.folio and r.estado = 'aceptado');
revoke all on public.citas_cobrables from anon, authenticated;
