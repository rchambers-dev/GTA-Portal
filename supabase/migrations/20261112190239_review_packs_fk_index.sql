-- Foreign key index from the performance advisor: review_packs (review_id, gta_id) -> reviews (id, gta_id).
create index review_packs_review_gta_idx on public.review_packs (review_id, gta_id);
