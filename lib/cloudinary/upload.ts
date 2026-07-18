// Direct browser → Cloudinary upload, via a pre-signed credential (see
// lib/cloudinary/actions.ts). Pure upload mechanics — no UI, no store, no
// React. XHR (not fetch) is used deliberately: it's the only way to get
// upload progress events in the browser.

export type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  duration?: number;
  format: string;
};

export function uploadToCloudinary(params: {
  file: File;
  resourceType: "video" | "image";
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
}): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", params.file);
    form.append("api_key", params.apiKey);
    form.append("timestamp", String(params.timestamp));
    form.append("signature", params.signature);
    form.append("folder", params.folder);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${params.cloudName}/${params.resourceType}/upload`,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && params.onProgress) {
        params.onProgress(e.loaded, e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Cloudinary returned an unexpected response."));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error?.message) message = body.error.message;
        } catch {
          /* ignore parse failure — use the generic message above */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.send(form);
  });
}
