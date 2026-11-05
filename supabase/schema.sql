-- 集个戳戳 · Supabase 建表脚本
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全部内容 → Run

create table if not exists cards (
  id            text primary key,
  owner_id      text not null,
  owner_name    text not null,
  theme         text not null default 'sport',
  goal          text not null,
  proof         text,
  freq_type     text not null default 'daily',   -- daily | weekly
  freq_n        int  not null default 7,
  days          int  not null,
  extra         int  not null default 0,          -- 每周模式下"加 2 格"累计
  reward_name   text not null,
  reward_amount numeric,
  abandoned_at  bigint,
  created_at    bigint not null
);

create table if not exists buddies (
  card_id      text not null references cards(id) on delete cascade,
  user_id      text not null,
  user_name    text not null,
  custom_stamp text not null,
  created_at   bigint not null,
  primary key (card_id, user_id)
);

create table if not exists checkins (
  id         text primary key,
  card_id    text not null references cards(id) on delete cascade,
  date       text not null,                       -- 北京时间 YYYY-MM-DD
  attempt    int  not null default 1,
  image_url  text,
  note       text,
  created_at bigint not null
);

create table if not exists stamps (
  id         text primary key,
  card_id    text not null references cards(id) on delete cascade,
  checkin_id text not null references checkins(id) on delete cascade,
  user_id    text not null,
  user_name  text not null,
  kind       text not null,                       -- stamp | nope
  text       text,
  color      text,
  comment    text,
  created_at bigint not null
);

create table if not exists raises (
  id         text primary key,
  card_id    text not null references cards(id) on delete cascade,
  user_id    text not null,
  user_name  text not null,
  status     text not null default 'pending',     -- pending | accepted | declined
  created_at bigint not null
);

create index if not exists idx_cards_owner   on cards(owner_id);
create index if not exists idx_buddies_user  on buddies(user_id);
create index if not exists idx_checkins_card on checkins(card_id);
create index if not exists idx_stamps_card   on stamps(card_id);
create index if not exists idx_raises_card   on raises(card_id);

-- 原型阶段：只在熟人群测试，允许匿名读写（不允许删除）。
-- 正式上线前必须换成按用户鉴权的策略。
do $$
declare t text;
begin
  foreach t in array array['cards','buddies','checkins','stamps','raises'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon read" on %I', t);
    execute format('drop policy if exists "anon insert" on %I', t);
    execute format('create policy "anon read" on %I for select to anon using (true)', t);
    execute format('create policy "anon insert" on %I for insert to anon with check (true)', t);
  end loop;
end $$;

drop policy if exists "anon update" on cards;
create policy "anon update" on cards for update to anon using (true) with check (true);
drop policy if exists "anon update" on raises;
create policy "anon update" on raises for update to anon using (true) with check (true);

-- 打卡照片存储桶（公开读）
insert into storage.buckets (id, name, public) values ('checkins', 'checkins', true) on conflict (id) do nothing;
drop policy if exists "anon upload checkins" on storage.objects;
create policy "anon upload checkins" on storage.objects for insert to anon with check (bucket_id = 'checkins');
