-- Run this in Supabase SQL Editor if you haven't already done step 3
-- (Steps 1 and 2 already done according to user)

-- Step 3: Auto-create a profile on sign up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
