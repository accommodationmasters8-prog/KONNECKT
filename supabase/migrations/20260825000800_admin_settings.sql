-- =============================================================================
-- 0008 — ADMIN-EDITABLE SETTINGS, AND SOMEWHERE TO PUT AN UPLOADED LOGO
--
-- Everything an HQ administrator can change from the console without a deploy:
-- the strings on the landing page, the partner strip's own labels, the contact
-- details in the footer, and the switches that decide what is shown at all.
--
-- One table, keyed by a dotted name, with the value in jsonb. Not a column per
-- setting: a column per setting means a migration every time Marketing wants a
-- new sentence, and a migration is exactly what this table exists to avoid.
-- The keys that matter are listed in `konekt.site_setting_keys` so the console
-- can render a form for them, and so a typo writes a row nobody reads rather
-- than silently overriding a real one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The settings themselves
-- -----------------------------------------------------------------------------
create table konekt.site_settings (
  key          text primary key,
  value        jsonb not null,

  updated_at   timestamptz not null default now(),
  updated_by   uuid references konekt.staff_users(id) on delete set null,

  constraint setting_key_is_dotted check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$')
);

comment on table konekt.site_settings is
  'Admin-editable content and switches. A row here changes the live site '
  'without a deploy; every write is audited like any other staff write.';

-- -----------------------------------------------------------------------------
-- What the console offers to edit
--
-- A catalogue rather than a hardcoded list in the application, so adding a
-- setting is a row here and not a release. `kind` decides the input the console
-- renders; `is_localised` says the value carries one string per locale.
-- -----------------------------------------------------------------------------
create table konekt.site_setting_keys (
  key           text primary key,
  label         text not null,
  help          text,
  kind          text not null
                  check (kind in ('text', 'long_text', 'url', 'email', 'phone', 'boolean', 'number')),
  is_localised  boolean not null default false,
  group_name    text not null,
  display_order smallint not null default 0
);

comment on table konekt.site_setting_keys is
  'The catalogue the settings screen is built from. Adding an editable field '
  'is a row here, not a release.';

insert into konekt.site_setting_keys
  (key, label, help, kind, is_localised, group_name, display_order) values
  ('site.hero_eyebrow',      'Hero eyebrow',        'The small line above the headline.', 'text', true, 'Landing page', 10),
  ('site.hero_subline',      'Hero subline',        'The sentence under the headline.', 'long_text', true, 'Landing page', 20),
  ('site.hero_cta_primary',  'Primary button',      null, 'text', true, 'Landing page', 30),
  ('site.hero_cta_secondary','Secondary button',    null, 'text', true, 'Landing page', 40),
  ('partners.title',         'Partner strip title', null, 'text', true, 'Partners', 10),
  ('partners.note',          'Partner strip note',  'Shown beside the title. Keep it honest about what is signed.', 'text', true, 'Partners', 20),
  ('partners.show_strip',    'Show the partner strip', 'Off hides it from the landing page entirely.', 'boolean', false, 'Partners', 30),
  ('contact.support_email',  'Support email',       null, 'email', false, 'Contact', 10),
  ('contact.support_phone',  'Support phone',       null, 'phone', false, 'Contact', 20),
  ('contact.whatsapp_url',   'WhatsApp link',       null, 'url', false, 'Contact', 30),
  ('membership.open',        'Registration is open','Off puts the membership page into "opening soon".', 'boolean', false, 'Switches', 10),
  ('events.show_samples',    'Show sample events',  'Off hides the sample programme once real events are published.', 'boolean', false, 'Switches', 20);

-- -----------------------------------------------------------------------------
-- Partner logo, uploaded rather than committed
--
-- brand_placements already carries logo_path and the clearance columns that
-- stop an uncleared mark going live (migration 0007). This adds the column the
-- console needs to show who uploaded what, and when — the clearance record says
-- a use was approved, which is a different fact from who put the file there.
-- -----------------------------------------------------------------------------
alter table konekt.brand_placements
  add column uploaded_by uuid references konekt.staff_users(id) on delete set null,
  add column uploaded_at timestamptz;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table konekt.site_settings enable row level security;
alter table konekt.site_settings force row level security;
alter table konekt.site_setting_keys enable row level security;
alter table konekt.site_setting_keys force row level security;

-- The public site reads these on every render; they are the copy on the page.
create policy settings_public_read on konekt.site_settings
  for select to anon, authenticated using (true);
create policy setting_keys_public_read on konekt.site_setting_keys
  for select to anon, authenticated using (true);

-- Writing them changes what every visitor sees, nationally. HQ only — the same
-- bar as the partner strip, for the same reason.
create policy settings_hq_write on konekt.site_settings
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());
create policy setting_keys_hq_write on konekt.site_setting_keys
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

grant select on konekt.site_settings, konekt.site_setting_keys to anon, authenticated;
grant insert, update, delete on konekt.site_settings, konekt.site_setting_keys to authenticated;

-- Audited like every other staff write, and stamped on update.
create trigger site_settings_touch
  before update on konekt.site_settings
  for each row execute function konekt.touch_updated_at();

create trigger site_settings_audit
  after insert or update or delete on konekt.site_settings
  for each row execute function konekt.write_audit();

create trigger site_setting_keys_audit
  after insert or update or delete on konekt.site_setting_keys
  for each row execute function konekt.write_audit();

-- -----------------------------------------------------------------------------
-- Storage for uploaded logos
--
-- Guarded: `storage` exists on Supabase and does not exist on a plain
-- PostgreSQL instance, and the migrations have to keep running on both — the
-- authorisation suite in supabase/tests runs against plain PostGIS.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'partner-logos',
      'partner-logos',
      true,                       -- read by every visitor; it is a logo on a public page
      524288,                     -- 512KB. A logo that needs more than that is a photograph.
      array['image/svg+xml', 'image/png', 'image/webp']
    )
    on conflict (id) do update
      set file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    -- Public read, HQ write. The bucket is public, so the read policy is a
    -- formality; the write policy is not.
    drop policy if exists partner_logos_public_read on storage.objects;
    create policy partner_logos_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'partner-logos');

    drop policy if exists partner_logos_hq_write on storage.objects;
    create policy partner_logos_hq_write on storage.objects
      for all to authenticated
      using (bucket_id = 'partner-logos' and konekt.is_hq())
      with check (bucket_id = 'partner-logos' and konekt.is_hq());

  end if;
end $$;
