// src/components/FileUploader.tsx
import React from 'react';
import { useDropzone } from 'react-dropzone';
import { FileProcessorActions } from '../hooks/useFileProcessor';

interface FileUploaderProps {
  onFileUpload: FileProcessorActions['handleFileUpload'];
  disabled: boolean;
  smsVkLoaded: boolean;
  whatsappLoaded: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, disabled, smsVkLoaded, whatsappLoaded }) => {
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    multiple: false,
    disabled,
  });

  let uploadText = "Перетащите файл SMS/VK или WhatsApp, или нажмите для выбора";
  if (smsVkLoaded) {
    uploadText = "Перетащите файл WhatsApp или нажмите для выбора";
  } else if (whatsappLoaded) {
    uploadText = "Перетащите файл SMS/VK или нажмите для выбора";
  }

  return (
    <div
      {...getRootProps()}
      className={`w-full max-w-md p-6 border-2 border-dashed rounded-2xl text-center transition cursor-pointer shadow-sm mx-auto ${
        isDragActive ? "bg-green-100 border-green-400" : "bg-white border-gray-300 hover:border-blue-400"
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <p className="text-gray-600">
        {isDragActive ? "Отпустите файл..." : uploadText}
      </p>
    </div>
  );
};

export default FileUploader;