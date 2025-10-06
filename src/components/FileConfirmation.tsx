// src/components/FileConfirmation.tsx
import React from 'react';
// --- Добавлен импорт useDropzone ---
import { useDropzone } from 'react-dropzone';
// --- /Добавлен импорт useDropzone ---
import { FileProcessorActions } from '../hooks/useFileProcessor';

interface FileConfirmationProps {
  smsVkLoaded: boolean;
  whatsappLoaded: boolean;
  onStartAnalysis: FileProcessorActions['startAnalysis'];
  onFileUpload: FileProcessorActions['handleFileUpload'];
  disabled: boolean;
}

const FileConfirmation: React.FC<FileConfirmationProps> = ({
  smsVkLoaded,
  whatsappLoaded,
  onStartAnalysis,
  onFileUpload,
  disabled,
}) => {
  const onDropSecondFile = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps: getRootPropsSecond, getInputProps: getInputPropsSecond, isDragActive: isDragActiveSecond } = useDropzone({
    onDrop: onDropSecondFile,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    multiple: false,
    disabled,
  });

  if (!smsVkLoaded && !whatsappLoaded) {
    // Это состояние не должно возникать, если компонент рендерится
    return null;
  }

  if (smsVkLoaded && !whatsappLoaded) {
    return (
      <div className="flex flex-col items-center space-y-2 mt-4 w-full max-w-md">
        <p className="text-gray-700 text-center">Загружен файл SMS/VK. Проанализировать только его?</p>
        <button
          onClick={onStartAnalysis}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
        >
          Да, анализировать SMS/VK
        </button>
        <p className="text-gray-500 text-sm text-center">Или загрузите файл WhatsApp для полного анализа каскада.</p>
        <div
          {...getRootPropsSecond()}
          className={`w-full p-4 border-2 border-dashed rounded-xl text-center transition cursor-pointer ${
            isDragActiveSecond ? "bg-green-100 border-green-400" : "bg-gray-50 border-gray-300 hover:border-blue-400"
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputPropsSecond()} />
          <p className="text-gray-600">
            {isDragActiveSecond ? "Отпустите файл WhatsApp..." : "Загрузить файл WhatsApp"}
          </p>
        </div>
      </div>
    );
  }

  if (!smsVkLoaded && whatsappLoaded) {
    return (
      <div className="flex flex-col items-center space-y-2 mt-4 w-full max-w-md">
        <p className="text-gray-700 text-center">Загружен файл WhatsApp. Проанализировать только его?</p>
        <button
          onClick={onStartAnalysis}
          className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
        >
          Да, анализировать WhatsApp
        </button>
        <p className="text-gray-500 text-sm text-center">Или загрузите файл SMS/VK для полного анализа каскада.</p>
        <div
          {...getRootPropsSecond()}
          className={`w-full p-4 border-2 border-dashed rounded-xl text-center transition cursor-pointer ${
            isDragActiveSecond ? "bg-green-100 border-green-400" : "bg-gray-50 border-gray-300 hover:border-blue-400"
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputPropsSecond()} />
          <p className="text-gray-600">
            {isDragActiveSecond ? "Отпустите файл SMS/VK..." : "Загрузить файл SMS/VK"}
          </p>
        </div>
      </div>
    );
  }

  // Если оба загружены, анализ должен запускаться автоматически или не отображаться этот компонент
  return null;
};

export default FileConfirmation;