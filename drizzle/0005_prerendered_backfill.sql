-- Pre-rendered camera-move examples served to users were stored as 'sample'. They get their own
-- value now. Image stand-ins from before the backend audit stay 'sample': that's what they were.
UPDATE "assets" SET "source" = 'prerendered' WHERE "source" = 'sample' AND "kind" = 'video';
