import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (filePath, keepLocal = false) => {
    try {
        if (!filePath) {
            throw new Error('File path is missing');
        }

        if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist: ${filePath}`);
        }

        const fileExtension = filePath.split('.').pop().toLowerCase();
        const isPdf = fileExtension === 'pdf';

        if (isPdf) {
            const fileName = path.basename(filePath);
            console.log(`PDF kept locally: /uploads/${fileName}`);
            return `/uploads/${fileName}`;
        }

        const uploadOptions = {
            folder: 'healthlink-medical-reports',
            resource_type: 'image',
            access_mode: 'public',
            type: 'upload',
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        };

        const uploadResult = await cloudinary.uploader.upload(filePath, uploadOptions);

        fs.unlinkSync(filePath);
        console.log(`Image uploaded to Cloudinary: ${uploadResult.secure_url}`);

        return uploadResult.secure_url;
    } catch (error) {
        const fileExtension = filePath.split('.').pop().toLowerCase();
        if (fileExtension !== 'pdf' && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error(`Upload failed: ${error.message}`);
    }
};

export default uploadOnCloudinary;