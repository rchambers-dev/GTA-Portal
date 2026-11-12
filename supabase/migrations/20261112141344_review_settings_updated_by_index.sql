-- Performance advisor: unindexed foreign key on review_settings.updated_by.
create index review_settings_updated_by_idx on public.review_settings (updated_by) where updated_by is not null;
