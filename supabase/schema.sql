-- 奖金请批准 · Supabase 建表脚本
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全部内容 → Run

create table if not exists challenges (
  id               text primary key,
  owner_id         text not null,
  owner_name       text not null,
  theme            text not null default 'fitness',
  objective        text not null,
  kr               text,
  freq_type        text not null default 'daily',
  freq_n           int  not null default 7,
  days             int  not null,
  reward_name      text not null,
  reward_amount    numeric,
  submitted_at     bigint not null,
  raise_accepted_at bigint,
  abandoned_at     bigint,
  created_at       bigint not null
);

create table if not exists members (
  challenge_id text not null references challenges(id) on delete cascade,
  user_id      text not null,
  user_name    text not null,
  created_at   bigint not null,
  primary key (challenge_id, user_id)
);

create table if not exists reviews (
  id            text primary key,
  challenge_id  text not null references challenges(id) on delete cascade,
  target_type   text not null,          -- challenge | checkin
  target_id     text not null,
  reviewer_id   text not null,
  reviewer_name text not null,
  result        text not null,          -- pass | reject | raise
  reason        text,
  raise_days    int,
  raise_n       int,
  created_at    bigint not null
);

create table if not exists checkins (
  id           text primary key,
  challenge_id text not null references challenges(id) on delete cascade,
  date         text not null,           -- 北京时间 YYYY-MM-DD
  attempt      int  not null default 1,
  image_url    text,
  note         text,
  created_at   bigint not null
);

create index if not exists idx_members_user on members(user_id);
create index if not exists idx_reviews_ch on reviews(challenge_id);
create index if not exists idx_checkins_ch on checkins(challenge_id);
create index if not exists idx_challenges_owner on challenges(owner_id);

-- 原型阶段：只在熟人群测试，允许匿名读写（不允许删除）。
-- 正式上线前必须换成按用户鉴权的策略。
alter table challenges enable row level security;
alter table members    enable row level security;
alter table reviews    enable row level security;
alter table checkins   enable row level security;

drop policy if exists "anon read"   on challenges;
drop policy if exists "anon insert" on challenges;
drop policy if exists "anon update" on challenges;
create policy "anon read"   on challenges for select to anon using (true);
create policy "anon insert" on challenges for insert to anon with check (true);
create policy "anon update" on challenges for update to anon using (true) with check (true);

drop policy if exists "anon read"   on members;
drop policy if exists "anon insert" on members;
create policy "anon read"   on members for select to anon using (true);
create policy "anon insert" on members for insert to anon with check (true);

drop policy if exists "anon read"   on reviews;
drop policy if exists "anon insert" on reviews;
create policy "anon read"   on reviews for select to anon using (true);
create policy "anon insert" on reviews for insert to anon with check (true);

drop policy if exists "anon read"   on checkins;
drop policy if exists "anon insert" on checkins;
create policy "anon read"   on checkins for select to anon using (true);
create policy "anon insert" on checkins for insert to anon with check (true);

-- 打卡图片存储桶（公开读）
insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', true)
on conflict (id) do nothing;

drop policy if exists "anon upload checkins" on storage.objects;
create policy "anon upload checkins" on storage.objects
  for insert to anon with check (bucket_id = 'checkins');
