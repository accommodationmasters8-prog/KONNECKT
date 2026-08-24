-- =============================================================================
-- CRDB KONEKT — 0007  Editorial content
-- =============================================================================
-- Blog, partner logos and the site's own copy blocks. Bilingual throughout:
-- a post without Swahili cannot be published, because Swahili is not a
-- translation added at the end.
-- =============================================================================

create type konekt.post_status as enum ('draft', 'in_review', 'published', 'archived');

create table konekt.authors (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  role_en     text,
  role_sw     text,
  bio_en      text,
  bio_sw      text,
  avatar_path text,
  staff_id    uuid references konekt.staff_users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table konekt.post_categories (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  name_en  text not null,
  name_sw  text not null,
  -- Which brand accent this category carries. Constrained to the four brand
  -- colours so a category cannot introduce a fifth.
  accent   text not null default 'teal'
             check (accent in ('teal', 'green', 'yellow', 'pink')),
  display_order smallint not null default 0
);

create table konekt.posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  category_id   uuid references konekt.post_categories(id) on delete set null,
  author_id     uuid references konekt.authors(id) on delete set null,

  title_en      text not null,
  title_sw      text not null,
  excerpt_en    text not null,
  excerpt_sw    text not null,
  body_en       text not null,
  body_sw       text not null,

  cover_image_path text,
  cover_alt_en  text,
  cover_alt_sw  text,

  status        konekt.post_status not null default 'draft',
  published_at  timestamptz,
  reading_minutes smallint,

  -- Never optional. A post that repeats a statistic has to say where it came
  -- from, the same as everything else on this platform.
  source_name   text,
  source_url    text,

  is_featured   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint published_post_has_a_date check (
    status <> 'published' or published_at is not null
  ),
  -- Both languages or neither. A published post missing its Swahili would
  -- quietly turn the Swahili site into an English one.
  constraint published_post_is_bilingual check (
    status <> 'published'
    or (length(btrim(body_sw)) > 0 and length(btrim(body_en)) > 0
        and length(btrim(title_sw)) > 0 and length(btrim(title_en)) > 0)
  ),
  constraint cover_image_has_alt_text check (
    cover_image_path is null
    or (cover_alt_en is not null and cover_alt_sw is not null)
  )
);

comment on constraint published_post_is_bilingual on konekt.posts is
  'Swahili and English are peers. A post cannot reach published with one of '
  'them empty, so the Swahili site can never silently degrade into English.';

comment on constraint cover_image_has_alt_text on konekt.posts is
  'An image without alt text in both locales cannot be attached. Accessibility '
  'is not a review step here, it is a write constraint.';

create index posts_published_ix on konekt.posts (status, published_at desc);
create index posts_category_ix on konekt.posts (category_id, published_at desc);

create table konekt.post_tags (
  post_id uuid not null references konekt.posts(id) on delete cascade,
  tag     text not null,
  primary key (post_id, tag)
);

-- -----------------------------------------------------------------------------
-- Partner logos shown on the public site.
--
-- Distinct from konekt.partners, which is the benefits ecosystem: a logo on the
-- landing page is a marketing placement and needs its own approval trail.
-- -----------------------------------------------------------------------------
create table konekt.brand_placements (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid references konekt.partners(id) on delete set null,

  name          text not null,
  logo_path     text,
  -- Inline SVG for the placements that must render without a network request.
  logo_svg      text,
  website_url   text,

  -- Where it appears: 'landing_strip', 'events_page', 'footer'.
  placement     text not null
                  check (placement in ('landing_strip', 'events_page', 'footer')),
  display_order smallint not null default 0,

  -- A logo is someone else's trademark. It does not go on the site until
  -- someone is recorded as having cleared its use.
  usage_approved_by text,
  usage_approved_at timestamptz,

  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint placement_has_a_logo check (logo_path is not null or logo_svg is not null),
  constraint active_placement_is_cleared check (
    is_active = false
    or (usage_approved_by is not null and usage_approved_at is not null)
  )
);

comment on constraint active_placement_is_cleared on konekt.brand_placements is
  'A partner logo cannot go live without a named person recording that its use '
  'was cleared. Publishing someone else than CRDB''s mark is a legal act.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table konekt.authors enable row level security;
alter table konekt.post_categories enable row level security;
alter table konekt.posts enable row level security;
alter table konekt.post_tags enable row level security;
alter table konekt.brand_placements enable row level security;

alter table konekt.authors force row level security;
alter table konekt.post_categories force row level security;
alter table konekt.posts force row level security;
alter table konekt.post_tags force row level security;
alter table konekt.brand_placements force row level security;

create policy authors_public_read on konekt.authors
  for select to anon, authenticated using (true);
create policy categories_public_read on konekt.post_categories
  for select to anon, authenticated using (true);
create policy tags_public_read on konekt.post_tags
  for select to anon, authenticated using (true);

create policy posts_public_read on konekt.posts
  for select to anon, authenticated
  using (status = 'published' and published_at <= now());

create policy posts_staff_read on konekt.posts
  for select to authenticated using (konekt.is_staff());
create policy posts_staff_write on konekt.posts
  for all to authenticated using (konekt.is_staff()) with check (konekt.is_staff());

create policy placements_public_read on konekt.brand_placements
  for select to anon, authenticated using (is_active);
create policy placements_hq_write on konekt.brand_placements
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

create policy authors_hq_write on konekt.authors
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());
create policy categories_hq_write on konekt.post_categories
  for all to authenticated using (konekt.is_hq()) with check (konekt.is_hq());

grant select on konekt.authors, konekt.post_categories, konekt.posts,
  konekt.post_tags, konekt.brand_placements to anon, authenticated;
grant insert, update, delete on konekt.posts, konekt.authors,
  konekt.post_categories, konekt.post_tags, konekt.brand_placements
  to authenticated;

do $$
declare t text;
begin
  foreach t in array array['posts', 'brand_placements'] loop
    execute format(
      'create trigger %I_touch before update on konekt.%I
       for each row execute function konekt.touch_updated_at()', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on konekt.%I
       for each row execute function konekt.write_audit()', t, t);
  end loop;
end $$;
