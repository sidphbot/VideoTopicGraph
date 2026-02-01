-- Initialize Video Topic Graph Platform Database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Create default quota policy
INSERT INTO quota_policies (
    id,
    name,
    max_videos_per_month,
    max_storage_gb,
    max_public_links,
    max_versions_per_video,
    max_video_duration_minutes,
    allowed_models
) VALUES (
    'default',
    'Default Plan',
    10,
    5.0,
    20,
    5,
    120,
    '["whisper", "faster-whisper", "all-MiniLM-L6-v2", "mistral"]'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO quota_policies (
    id,
    name,
    max_videos_per_month,
    max_storage_gb,
    max_public_links,
    max_versions_per_video,
    max_video_duration_minutes,
    allowed_models
) VALUES (
    'premium',
    'Premium Plan',
    100,
    50.0,
    100,
    20,
    300,
    '["whisper", "faster-whisper", "whisper-cpp", "all-MiniLM-L6-v2", "all-mpnet-base-v2", "mistral", "mixtral"]'
) ON CONFLICT (id) DO NOTHING;

-- Create admin policy
INSERT INTO quota_policies (
    id,
    name,
    max_videos_per_month,
    max_storage_gb,
    max_public_links,
    max_versions_per_video,
    max_video_duration_minutes,
    allowed_models
) VALUES (
    'unlimited',
    'Unlimited Plan',
    999999,
    999999.0,
    999999,
    999999,
    999999,
    '["*"]'
) ON CONFLICT (id) DO NOTHING;
