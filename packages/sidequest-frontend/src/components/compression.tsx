import imageCompression from 'browser-image-compression';
import type { Options } from 'browser-image-compression';

export const compressImage = async (file: File): Promise<File> => {
    const options: Options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
    };
    try {
        const compressedFile = await imageCompression(file, options);
        return compressedFile;
    } catch (error) {
        console.error('image compression failed, try uploading again', error);
        throw error;
    }
};