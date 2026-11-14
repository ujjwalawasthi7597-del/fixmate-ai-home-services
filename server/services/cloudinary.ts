import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../config/env.ts';

let configured = false;

function ensureCloudinary() {
  if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
    throw Object.assign(
      new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Settings > Secrets.'),
      { status: 503 }
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
      api_key: ENV.CLOUDINARY_API_KEY,
      api_secret: ENV.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

export async function uploadImageBuffer(buffer: Buffer, folder = 'fixmate'): Promise<{ url: string; publicId: string }> {
  ensureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload failed.'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}
