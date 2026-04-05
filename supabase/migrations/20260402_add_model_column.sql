-- Add model column to generations table for tracking which specific AI model was used
-- e.g. 'seedream-lite-v5', 'nano-banana-2', 'kling-v3', 'veo-3.1'
alter table generations add column if not exists model text;
