import imageCompression from "browser-image-compression";
import type { Options } from "browser-image-compression";

export const compressImage = async (
  file: File
): Promise<File> => {
  const options: Options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };
  try {
    const compressedFile = await imageCompression(
      file,
      options
    );
    return compressedFile;
  } catch {
    throw new Error(
      "Could not prepare this image. Choose another image and try again."
    );
  }
};
