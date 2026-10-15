-- Ready is a first-class review queue between New and Applied.
-- It removes manually selected jobs from the New queue without losing audit history.
alter type public."Job Status" add value if not exists 'ready';

comment on type public."Job Status" is 'Job workflow status: new, ready, applied, archived, deleted, processing, or excluded_by_advanced_matching.';
