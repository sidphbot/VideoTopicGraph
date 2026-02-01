/**
 * Storage Test Helpers
 */

import { Client } from 'minio';

let minioClient: Client;

export async function setupTestStorage(): Promise<void> {
  minioClient = new Client({
    endPoint: process.env.TEST_MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.TEST_MINIO_PORT || '9000'),
    useSSL: false,
    accessKey: process.env.TEST_MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.TEST_MINIO_SECRET_KEY || 'minioadmin',
  });

  const bucket = process.env.TEST_MINIO_BUCKET || 'video-graph-test';
  
  // Create bucket if it doesn't exist
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
  }
}

export async function teardownTestStorage(): Promise<void> {
  const bucket = process.env.TEST_MINIO_BUCKET || 'video-graph-test';
  
  // Clear all objects
  const objects = await minioClient.listObjects(bucket, '', true);
  for await (const obj of objects) {
    await minioClient.removeObject(bucket, obj.name);
  }
}

export function getTestStorage() {
  return minioClient;
}
