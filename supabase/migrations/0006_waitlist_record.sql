-- Rodizium · recorde declarado pela pessoa no slider da landing ("quantas peças você aguenta?")
alter table public.waitlist add column claimed_record integer check (claimed_record is null or claimed_record between 0 and 200);
